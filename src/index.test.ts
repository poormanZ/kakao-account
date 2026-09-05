import { describe, expect, it } from "vitest";
import worker from "./index";
import { hashSessionId } from "./auth";

const SESSION_COOKIE = "kakao_account_session";

interface FakeRow {
  id?: number;
  nickname?: string | null;
  profile_image_url?: string | null;
  expires_at?: string;
  setting_key?: string;
  setting_value?: string;
}

const createDb = (options: {
  session?: FakeRow | null;
  settings?: FakeRow[];
} = {}) => {
  const settings = options.settings ?? [];
  const session = options.session ?? null;

  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions s JOIN users u")) return session as T;
              if (sql.includes("FROM users WHERE kakao_user_id")) return null as T;
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

const env = (DB: D1Database) => ({
  DB,
  APP_BASE_URL: "http://localhost:8787",
  KAKAO_REDIRECT_URI: "http://localhost:8787/auth/kakao/callback",
});

describe("account authentication APIs", () => {
  it("returns 401 for /api/me without a session", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/me"),
      env(createDb()),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns the authenticated internal user from a valid session", async () => {
    const rawSession = "test-session";
    const sessionHash = await hashSessionId(rawSession);
    const response = await worker.fetch(
      new Request("http://localhost/api/me", {
        headers: { Cookie: `${SESSION_COOKIE}=${rawSession}` },
      }),
      env(createDb({
        session: {
          id: 7,
          nickname: "tester",
          profile_image_url: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
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
      new Request("http://localhost/api/me", {
        headers: { Cookie: `${SESSION_COOKIE}=expired-session` },
      }),
      env(createDb({
        session: {
          id: 7,
          nickname: "tester",
          profile_image_url: null,
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      })),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("requires authentication for settings", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/settings"),
      env(createDb()),
    );

    expect(response.status).toBe(401);
  });

  it("returns settings for the authenticated user", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/settings", {
        headers: { Cookie: `${SESSION_COOKIE}=valid-session` },
      }),
      env(createDb({
        session: {
          id: 7,
          nickname: "tester",
          profile_image_url: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
        settings: [
          { setting_key: "theme", setting_value: "dark" },
          { setting_key: "locale", setting_value: "ko-KR" },
        ],
      })),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: { theme: "dark", locale: "ko-KR" },
    });
  });

  it("rejects invalid setting keys", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/settings/not%20allowed", {
        method: "PUT",
        headers: {
          Cookie: `${SESSION_COOKIE}=valid-session`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: "x" }),
      }),
      env(createDb({
        session: {
          id: 7,
          nickname: "tester",
          profile_image_url: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
      })),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid setting key" });
  });
});
