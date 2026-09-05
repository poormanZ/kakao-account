import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

const SESSION_COOKIE = "kakao_account_session";

afterEach(() => vi.restoreAllMocks());

const createDb = () => {
  const statements: string[] = [];
  const batch = vi.fn(async (queries: D1PreparedStatement[]) => {
    statements.push(...queries.map((query) => String(query)));
    return [];
  });

  const db = {
    prepare(sql: string) {
      return {
        bind(..._args: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("FROM sessions s JOIN users u")) {
                return {
                  id: 7,
                  nickname: "tester",
                  profile_image_url: null,
                  expires_at: new Date(Date.now() + 60_000).toISOString(),
                } as T;
              }
              return null as T;
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
    batch,
  } as unknown as D1Database;

  return { db, batch, statements };
};

describe("account deletion API", () => {
  it("requires authentication", async () => {
    const db = createDb().db;
    const response = await worker.fetch(
      new Request("http://localhost/api/account", { method: "DELETE" }),
      {
        DB: db,
        APP_BASE_URL: "http://localhost:8787",
        KAKAO_REDIRECT_URI: "http://localhost:8787/auth/kakao/callback",
      },
    );

    expect(response.status).toBe(401);
  });

  it("requires explicit DELETE confirmation", async () => {
    const db = createDb().db;
    const response = await worker.fetch(
      new Request("https://example.com/api/account", {
        method: "DELETE",
        headers: {
          Cookie: `${SESSION_COOKIE}=valid-session`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "delete" }),
      }),
      {
        DB: db,
        APP_BASE_URL: "https://example.com",
        KAKAO_REDIRECT_URI: "https://example.com/auth/kakao/callback",
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Account deletion requires confirmation" });
  });

  it("deletes user-owned settings, sessions, and the user atomically", async () => {
    const { db, batch, statements } = createDb();
    const response = await worker.fetch(
      new Request("https://example.com/api/account", {
        method: "DELETE",
        headers: {
          Cookie: `${SESSION_COOKIE}=valid-session`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      }),
      {
        DB: db,
        APP_BASE_URL: "https://example.com",
        KAKAO_REDIRECT_URI: "https://example.com/auth/kakao/callback",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(batch).toHaveBeenCalledTimes(1);
    expect(statements).toEqual([
      "[object Object]",
      "[object Object]",
      "[object Object]",
    ]);
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Secure");
  });
});
