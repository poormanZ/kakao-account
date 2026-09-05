import { afterEach, describe, expect, it, vi } from "vitest";
import app from "./app";
import { hashSessionId } from "./auth";

const SESSION_COOKIE = "kakao_account_session";
const STATE_COOKIE = "kakao_oauth_state";

const env = (DB: D1Database) => ({
  DB,
  APP_BASE_URL: "https://example.com",
  KAKAO_REDIRECT_URI: "https://example.com/auth/kakao/callback",
  KAKAO_REST_API_KEY: "test-rest-key",
  KAKAO_CLIENT_SECRET: "test-client-secret",
});

const createDb = (nickname: string | null = "tester") => {
  const executed: string[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions s JOIN users u")) {
                return nickname === null ? null : {
                  id: 7,
                  nickname,
                  profile_image_url: null,
                  expires_at: new Date(Date.now() + 60_000).toISOString(),
                } as T;
              }
              if (sql.includes("SELECT id FROM users WHERE nickname")) {
                return args[0] === "taken" ? ({ id: 9 } as T) : null;
              }
              if (sql.includes("SELECT id, nickname, profile_image_url FROM users")) {
                return { id: 7, nickname, profile_image_url: null } as T;
              }
              return null as T;
            },
            async run() {
              executed.push(sql);
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { db, executed };
};

afterEach(() => vi.restoreAllMocks());

describe("account web page", () => {
  it("renders a login page for an unauthenticated visitor", async () => {
    const { db } = createDb(null);
    const response = await app.fetch(new Request("https://example.com/"), env(db));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("카카오로 로그인");
    expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("renders the authenticated nickname from the database", async () => {
    const rawSession = "test-session";
    const { db } = createDb("tester");
    const response = await app.fetch(
      new Request("https://example.com/", { headers: { Cookie: `${SESSION_COOKIE}=${rawSession}` } }),
      env(db),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("tester");
    expect(await hashSessionId(rawSession)).toHaveLength(64);
  });

  it("rejects an already-used nickname", async () => {
    const { db } = createDb("tester");
    const response = await app.fetch(
      new Request("https://example.com/api/profile/nickname", {
        method: "PUT",
        headers: { Cookie: `${SESSION_COOKIE}=valid-session`, "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "taken" }),
      }),
      env(db),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Nickname already in use" });
  });

  it("updates the authenticated user's nickname", async () => {
    const { db, executed } = createDb("tester");
    const response = await app.fetch(
      new Request("https://example.com/api/profile/nickname", {
        method: "PUT",
        headers: { Cookie: `${SESSION_COOKIE}=valid-session`, "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: "new-name" }),
      }),
      env(db),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ nickname: "new-name" });
    expect(executed.some((sql) => sql.includes("UPDATE users SET nickname"))).toBe(true);
  });

  it("redirects a successful Kakao callback to the account page and stores Kakao nickname", async () => {
    const { db, executed } = createDb(null);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "secret-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12345, properties: { nickname: "카카오닉네임" } }), { status: 200 }));

    const response = await app.fetch(
      new Request("https://example.com/auth/kakao/callback?code=test-code&state=trusted", {
        headers: { Cookie: `${STATE_COOKIE}=trusted` },
      }),
      env(db),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://example.com/");
    expect(response.headers.get("Set-Cookie")).toContain(`${SESSION_COOKIE}=`);
    expect(executed.some((sql) => sql.includes("UPDATE users SET nickname"))).toBe(true);
  });
});
