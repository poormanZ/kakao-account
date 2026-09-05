export interface Env {
  DB: D1Database;
  APP_BASE_URL: string;
  KAKAO_REDIRECT_URI: string;
  KAKAO_REST_API_KEY?: string;
  KAKAO_CLIENT_SECRET?: string;
}

const SESSION_COOKIE = "kakao_account_session";
const STATE_COOKIE = "kakao_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_SETTING_KEY_LENGTH = 100;
const MAX_SETTING_VALUE_LENGTH = 10_000;

const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, {
    headers: { "Cache-Control": "no-store", ...init.headers },
    ...init,
  });

const randomHex = (byteLength: number): string => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hashSessionId = async (sessionId: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getCookie = (request: Request, name: string): string | null => {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
};

const cookie = (name: string, value: string, maxAge: number, secure: boolean): string =>
  `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

const clearCookie = (name: string, secure: boolean): string => cookie(name, "", 0, secure);
const stateCookie = (state: string, secure: boolean): string => cookie(STATE_COOKIE, state, 600, secure);
const sessionCookie = (sessionId: string, secure: boolean): string =>
  cookie(SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS, secure);

interface KakaoTokenResponse { access_token?: string; }
interface KakaoUserResponse { id?: number; }
interface UserRow {
  id: number;
  nickname: string | null;
  profile_image_url: string | null;
}
interface SessionUserRow extends UserRow { expires_at: string; }
interface SettingRow { setting_key: string; setting_value: string; }

const kakaoError = (headers: Headers) =>
  json({ error: "Kakao authentication failed" }, { status: 502, headers });

const getOrCreateUser = async (db: D1Database, kakaoUserId: string): Promise<UserRow> => {
  await db.prepare(
    `INSERT OR IGNORE INTO users (kakao_user_id, created_at, updated_at)
     VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).bind(kakaoUserId).run();

  const user = await db.prepare(
    `SELECT id, nickname, profile_image_url
     FROM users WHERE kakao_user_id = ? LIMIT 1`,
  ).bind(kakaoUserId).first<UserRow>();

  if (!user) throw new Error("Failed to create or load user");
  return user;
};

const createSession = async (db: D1Database, userId: number): Promise<string> => {
  const sessionId = randomHex(32);
  const sessionHash = await hashSessionId(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).bind(sessionHash, userId, expiresAt).run();

  return sessionId;
};

const getSessionUser = async (db: D1Database, sessionId: string): Promise<SessionUserRow | null> => {
  const sessionHash = await hashSessionId(sessionId);
  const session = await db.prepare(
    `SELECT u.id, u.nickname, u.profile_image_url, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? LIMIT 1`,
  ).bind(sessionHash).first<SessionUserRow>();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionHash).run();
    return null;
  }

  await db.prepare("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(sessionHash).run();
  return session;
};

const getAuthenticatedUser = async (request: Request, env: Env): Promise<UserRow | null> => {
  const sessionId = getCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;
  const sessionUser = await getSessionUser(env.DB, sessionId);
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    nickname: sessionUser.nickname,
    profile_image_url: sessionUser.profile_image_url,
  };
};

const parseSettingKey = (pathname: string): string | null => {
  const match = pathname.match(/^\/api\/settings\/([^/]+)$/);
  if (!match) return null;
  let key: string;
  try {
    key = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (!key || key.length > MAX_SETTING_KEY_LENGTH || !/^[A-Za-z0-9._-]+$/.test(key)) return null;
  return key;
};

const parseJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return null;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const secure = url.protocol === "https:";

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "kakao-account-api" });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({ service: "kakao-account-api", status: "ready" });
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao") {
      if (!env.KAKAO_REST_API_KEY) return json({ error: "Kakao login is not configured" }, { status: 503 });

      const state = randomHex(32);
      const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", env.KAKAO_REST_API_KEY);
      authorizeUrl.searchParams.set("redirect_uri", env.KAKAO_REDIRECT_URI);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("state", state);

      return new Response(null, {
        status: 302,
        headers: { Location: authorizeUrl.toString(), "Set-Cookie": stateCookie(state, secure), "Cache-Control": "no-store" },
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/callback") {
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const savedState = getCookie(request, STATE_COOKIE);
      const error = url.searchParams.get("error");
      const headers = new Headers({ "Cache-Control": "no-store" });
      headers.append("Set-Cookie", clearCookie(STATE_COOKIE, secure));

      if (error === "access_denied") return json({ error: "Kakao login was cancelled" }, { status: 400, headers });
      if (!code || !returnedState || !savedState || returnedState !== savedState) {
        return json({ error: "Invalid OAuth state or authorization code" }, { status: 400, headers });
      }
      if (!env.KAKAO_REST_API_KEY) return json({ error: "Kakao login is not configured" }, { status: 503, headers });

      try {
        const tokenBody = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: env.KAKAO_REST_API_KEY,
          redirect_uri: env.KAKAO_REDIRECT_URI,
          code,
        });
        if (env.KAKAO_CLIENT_SECRET) tokenBody.set("client_secret", env.KAKAO_CLIENT_SECRET);

        const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
          body: tokenBody,
        });
        if (!tokenResponse.ok) return kakaoError(headers);

        const token = await tokenResponse.json() as KakaoTokenResponse;
        if (!token.access_token) return kakaoError(headers);

        const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        });
        if (!userResponse.ok) return kakaoError(headers);

        const kakaoUser = await userResponse.json() as KakaoUserResponse;
        if (typeof kakaoUser.id !== "number") return kakaoError(headers);

        const user = await getOrCreateUser(env.DB, String(kakaoUser.id));
        const sessionId = await createSession(env.DB, user.id);
        headers.append("Set-Cookie", sessionCookie(sessionId, secure));

        return json({ authenticated: true, provider: "kakao", user: { id: user.id } }, { headers });
      } catch {
        return json({ error: "Kakao authentication failed" }, { status: 502, headers });
      }
    }

    if (request.method === "GET" && url.pathname === "/api/me") {
      const sessionId = getCookie(request, SESSION_COOKIE);
      if (!sessionId) return json({ error: "Unauthorized" }, { status: 401 });

      try {
        const user = await getSessionUser(env.DB, sessionId);
        if (!user) {
          return json({ error: "Unauthorized" }, {
            status: 401,
            headers: { "Set-Cookie": clearCookie(SESSION_COOKIE, secure) },
          });
        }
        return json({ authenticated: true, user: {
          id: user.id,
          nickname: user.nickname,
          profile_image_url: user.profile_image_url,
        }});
      } catch {
        return json({ error: "Authentication service unavailable" }, { status: 503 });
      }
    }

    if (url.pathname === "/api/settings" || url.pathname.startsWith("/api/settings/")) {
      let user: UserRow | null;
      try {
        user = await getAuthenticatedUser(request, env);
      } catch {
        return json({ error: "Authentication service unavailable" }, { status: 503 });
      }
      if (!user) return json({ error: "Unauthorized" }, { status: 401 });

      if (request.method === "GET" && url.pathname === "/api/settings") {
        try {
          const result = await env.DB.prepare(
            `SELECT setting_key, setting_value FROM user_settings
             WHERE user_id = ? ORDER BY setting_key`,
          ).bind(user.id).all<SettingRow>();
          const settings: Record<string, string> = {};
          for (const row of result.results) settings[row.setting_key] = row.setting_value;
          return json({ settings });
        } catch {
          return json({ error: "Settings service unavailable" }, { status: 503 });
        }
      }

      const key = parseSettingKey(url.pathname);
      if (!key) return json({ error: "Invalid setting key" }, { status: 400 });

      if (request.method === "PUT") {
        const body = await parseJsonBody(request);
        if (!body || typeof body.value !== "string") {
          return json({ error: "Request body must contain a string value" }, { status: 400 });
        }
        if (body.value.length > MAX_SETTING_VALUE_LENGTH) {
          return json({ error: "Setting value is too long" }, { status: 400 });
        }

        try {
          await env.DB.prepare(
            `INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(user_id, setting_key) DO UPDATE SET
               setting_value = excluded.setting_value,
               updated_at = CURRENT_TIMESTAMP`,
          ).bind(user.id, key, body.value).run();
          return json({ setting: { key, value: body.value } });
        } catch {
          return json({ error: "Settings service unavailable" }, { status: 503 });
        }
      }

      if (request.method === "DELETE") {
        try {
          const result = await env.DB.prepare(
            "DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?",
          ).bind(user.id, key).run();
          if (!result.meta.changes) return json({ error: "Setting not found" }, { status: 404 });
          return json({ deleted: true, key });
        } catch {
          return json({ error: "Settings service unavailable" }, { status: 503 });
        }
      }

      return json({ error: "Method Not Allowed" }, { status: 405, headers: { Allow: "GET, PUT, DELETE" } });
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      const sessionId = getCookie(request, SESSION_COOKIE);
      if (sessionId) {
        try {
          const sessionHash = await hashSessionId(sessionId);
          await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionHash).run();
        } catch {
          return json({ error: "Logout failed" }, { status: 503 });
        }
      }
      return json({ authenticated: false }, {
        headers: { "Set-Cookie": clearCookie(SESSION_COOKIE, secure) },
      });
    }

    return json({ error: "Not Found" }, { status: 404 });
  },
};
