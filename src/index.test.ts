import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { hashSessionId } from "./auth";

const SESSION_COOKIE = "kakao_account_session";
const STATE_COOKIE = "kakao_oauth_state";

interface FakeRow {
  id?: number;
  nickname?: string | null;
  profile_image_url?: string | null;
  expires_at?: string;
  setting_key?: string;
  setting_value?: string;
}

const getSetCookies = (headers: Headers): string[] => {
  const candidate = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof candidate.getSetCookie === "function") return candidate.getSetCookie();
  const value = headers.get("Set-Cookie");
  return value ? [value] : [];
};

const createDb = (options: {
  session?: FakeRow | null;
  user?: FakeRow | null;
  settings?: FakeRow[];
} = {}) => {
  const settings = options.settings ?? [];
  const session = options.session ?? null;
  const user = options.user ?? null;

  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions s JOIN users u")) return session as T;
              if (sql.includes("FROM users WHERE kakao_user_id")) return user as T;
              if (sql.includes("FROM user_settings") && sql.includes("LIMIT 1")) {
                const row = settings.find((item) => item.setting_key === args[1]);
                return (row ?? null) as T;
              }
              return null as T;
            },
            async all<T>() {
              if (sql.includes("FROM user_settings")) return { results: settings as T[] };
              return { results: [] as T[] };
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
};

const env = (DB: D1Database, overrides: Record<string, unknown> = {}) => ({
  DB,
  APP_BASE_URL: "http://localhost:8787",
  KAKAO_REDIRECT_URI: "http://localhost:8787/auth/kakao/callback",
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe("account authentication APIs", () => {
  it("returns 401 for /api/me without a session", async () => {
    const response = await worker.fetch(new Request("http://localhost/api/me"), env(createDb()));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns security headers on API responses", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/me"), env(createDb()));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(response.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("returns the authenticated internal user from a valid session", async () => {
    const rawSession = "test-session";
    const sessionHash = await hashSessionId(rawSession);
    const response = await worker.fetch(
      new Request("http://localhost/api/me", { headers: { Cookie: `${SESSION_COOKIE}=${rawSession}` } }),
      env(createDb({
        session: { id: 7, nickname: "tester", profile_image_url: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
      })),
    );

    expect(sessionHash).toHaveLength(64);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      user: { id: 7, nickname: "tester", profile_image_url: null },
    });
  });

  it("rejects an expired session and clears the cookie", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/me", { headers: { Cookie: `${SESSION_COOKIE}=expired-session` } }),
      env(createDb({
        session: { id: 7, nickname: "tester", profile_image_url: null, expires_at: new Date(Date.now() - 60_000).toISOString() },
      })),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("requires authentication for settings", async () => {
    const response = await worker.fetch(new Request("http://localhost/api/settings"), env(createDb()));
    expect(response.status).toBe(401);
  });

  it("returns settings for the authenticated user", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/settings", { headers: { Cookie: `${SESSION_COOKIE}=valid-session` } }),
      env(createDb({
        session: { id: 7, nickname: "tester", profile_image_url: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
        settings: [
          { setting_key: "theme", setting_value: "dark" },
          { setting_key: "locale", setting_value: "ko-KR" },
        ],
      })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ settings: { theme: "dark", locale: "ko-KR" } });
  });

  it("rejects invalid setting keys", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/settings/not%20allowed", {
        method: "PUT",
        headers: { Cookie: `${SESSION_COOKIE}=valid-session`, "Content-Type": "application/json" },
        body: JSON.stringify({ value: "x" }),
      }),
      env(createDb({
        session: { id: 7, nickname: "tester", profile_image_url: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
      })),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid setting key" });
  });

  it("starts Kakao login with a CSRF state cookie", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/auth/kakao"),
      env(createDb(), { KAKAO_REST_API_KEY: "test-rest-key" }),
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.origin).toBe("https://kauth.kakao.com");
    expect(location.searchParams.get("client_id")).toBe("test-rest-key");
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("state")).toMatch(/^[0-9a-f]{64}$/);
    const setCookies = getSetCookies(response.headers);
    expect(setCookies.some((cookie) => cookie.startsWith(`${STATE_COOKIE}=`))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("Max-Age=600"))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("Secure"))).toBe(true);
  });

  it("rejects an OAuth callback with a tampered state", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/auth/kakao/callback?code=test-code&state=attacker", {
        headers: { Cookie: `${STATE_COOKIE}=trusted-state` },
      }),
      env(createDb(), { KAKAO_REST_API_KEY: "test-rest-key" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid OAuth state or authorization code" });
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("handles Kakao login cancellation without calling Kakao APIs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await worker.fetch(
      new Request("https://example.com/auth/kakao/callback?error=access_denied", {
        headers: { Cookie: `${STATE_COOKIE}=trusted-state` },
      }),
      env(createDb(), { KAKAO_REST_API_KEY: "test-rest-key" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Kakao login was cancelled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a Kakao failure when token exchange fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("invalid code", { status: 400 }));
    const response = await worker.fetch(
      new Request("https://example.com/auth/kakao/callback?code=test-code&state=trusted-state", {
        headers: { Cookie: `${STATE_COOKIE}=trusted-state` },
      }),
      env(createDb(), { KAKAO_REST_API_KEY: "test-rest-key" }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Kakao authentication failed" });
  });

  it("reuses an existing internal user for the same Kakao identity", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "secret-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 123456789 }), { status: 200 }));

    const response = await worker.fetch(
      new Request("https://example.com/auth/kakao/callback?code=test-code&state=trusted-state", {
        headers: { Cookie: `${STATE_COOKIE}=trusted-state` },
      }),
      env(createDb({ user: { id: 7, nickname: "tester", profile_image_url: null } }), { KAKAO_REST_API_KEY: "test-rest-key" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true, provider: "kakao", user: { id: 7 } });
  });

  it("completes OAuth with a Kakao user and creates a service session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "secret-access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 123456789 }), { status: 200 }));

    const response = await worker.fetch(
      new Request("https://example.com/auth/kakao/callback?code=test-code&state=trusted-state", {
        headers: { Cookie: `${STATE_COOKIE}=trusted-state` },
      }),
      env(createDb({ user: { id: 7, nickname: "tester", profile_image_url: null } }), { KAKAO_REST_API_KEY: "test-rest-key" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true, provider: "kakao", user: { id: 7 } });
    const setCookies = getSetCookies(response.headers);
    expect(setCookies.some((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))).toBe(true);
    expect(setCookies.some((cookie) => cookie.startsWith(`${STATE_COOKIE}=`))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("Secure"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer secret-access-token" },
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("access_token");
  });

  it("logs out and clears the service session cookie", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/auth/logout", {
        method: "POST",
        headers: { Cookie: `${SESSION_COOKIE}=valid-session` },
      }),
      env(createDb()),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ logged_out: true });
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(response.headers.get("Set-Cookie")).toContain("Secure");
  });

  it("rejects unsupported settings methods", async () => {
    const response = await worker.fetch(
      new Request("https://example.com/api/settings/theme", {
        method: "PATCH",
        headers: { Cookie: `${SESSION_COOKIE}=valid-session` },
      }),
      env(createDb({
        session: { id: 7, nickname: "tester", profile_image_url: null, expires_at: new Date(Date.now() + 60_000).toISOString() },
      })),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, PUT, DELETE");
  });
});
