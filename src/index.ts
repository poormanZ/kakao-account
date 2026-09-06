import { getAuthenticatedUser, getCookie, getSessionUser, hashSessionId, type AuthUser } from "./auth";
import { render9GridPage } from "./9grid-ui";
import { get9GridBestScore, get9GridMyRank, get9GridRanking, save9GridScore } from "./9grid-score";
import { logError, logInfo, logWarn } from "./logger";

export interface Env {
  DB: D1Database;
  GAME_DB?: D1Database;
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

type UserRow = AuthUser;

const securityHeaders = (secure: boolean): Record<string, string> => ({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  ...(secure ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
});

const appendHeaders = (target: Headers, source: Headers): void => {
  const sourceWithGetCookie = source as Headers & { getSetCookie?: () => string[] };
  const setCookies = sourceWithGetCookie.getSetCookie?.();
  if (setCookies) for (const value of setCookies) target.append("Set-Cookie", value);
  source.forEach((value, key) => { if (key !== "set-cookie") target.set(key, value); });
};

const json = (data: unknown, init: ResponseInit = {}, secure = false) => {
  const headers = new Headers(securityHeaders(secure));
  if (init.headers) appendHeaders(headers, new Headers(init.headers));
  return Response.json(data, { ...init, headers });
};

const randomHex = (byteLength: number): string => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const cookie = (name: string, value: string, maxAge: number, secure: boolean): string =>
  `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
const clearCookie = (name: string, secure: boolean): string => cookie(name, "", 0, secure);
const stateCookie = (state: string, secure: boolean): string => cookie(STATE_COOKIE, state, 600, secure);
const sessionCookie = (sessionId: string, secure: boolean): string => cookie(SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS, secure);

interface KakaoTokenResponse { access_token?: string; }
interface KakaoUserResponse { id?: number; }
interface SettingRow { setting_key: string; setting_value: string; }

const kakaoError = (headers: Headers, secure: boolean, requestId: string, stage: string, status?: number) => {
  logWarn("kakao.request_failed", { request_id: requestId, stage, upstream_status: status ?? null });
  return json({ error: "Kakao authentication failed" }, { status: 502, headers }, secure);
};

const getOrCreateUser = async (db: D1Database, kakaoUserId: string): Promise<UserRow> => {
  await db.prepare(`INSERT OR IGNORE INTO users (kakao_user_id, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).bind(kakaoUserId).run();
  const user = await db.prepare(`SELECT id, nickname, profile_image_url FROM users WHERE kakao_user_id = ? LIMIT 1`).bind(kakaoUserId).first<UserRow>();
  if (!user) throw new Error("Failed to create or load user");
  return user;
};

const createSession = async (db: D1Database, userId: number): Promise<string> => {
  const sessionId = randomHex(32);
  const sessionHash = await hashSessionId(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).bind(sessionHash, userId, expiresAt).run();
  return sessionId;
};

const deleteAccount = async (db: D1Database, userId: number): Promise<void> => {
  await db.batch([
    db.prepare("DELETE FROM user_settings WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);
};

const parseSettingKey = (pathname: string): string | null => {
  const match = pathname.match(/^\/api\/settings\/([^/]+)$/);
  if (!match) return null;
  let key: string;
  try { key = decodeURIComponent(match[1]); } catch { return null; }
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
  } catch { return null; }
};

const cleanupExpiredSessions = async (db: D1Database): Promise<void> => {
  await db.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const secure = url.protocol === "https:";
    const requestId = randomHex(16);
    const context = { request_id: requestId, route: url.pathname, method: request.method };

    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok", service: "kakao-account-api" }, {}, secure);
    if (request.method === "GET" && url.pathname === "/") return json({ service: "kakao-account-api", status: "ready" }, {}, secure);

    if (request.method === "GET" && url.pathname === "/9grid") {
      let user: UserRow | null = null;
      try { user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); } catch (error) { logError("9grid.user_lookup_failed", error, context); }
      return render9GridPage(user);
    }

    if (url.pathname.startsWith("/api/games/9grid")) {
      let user: UserRow | null;
      try { user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); }
      catch (error) { logError("9grid.user_lookup_failed", error, context); return json({ error: "Authentication service unavailable" }, { status: 503 }, secure); }
      if (!user) return json({ error: "Unauthorized" }, { status: 401 }, secure);
      if (request.method === "POST" && url.pathname === "/api/games/9grid/scores") return save9GridScore(request, env, user);
      if (request.method === "GET" && url.pathname === "/api/games/9grid/best") return get9GridBestScore(env, user);
      if (request.method === "GET" && url.pathname === "/api/games/9grid/my-rank") return get9GridMyRank(env, user);
      if (request.method === "GET" && url.pathname === "/api/games/9grid/ranking") {
        const rawLimit = Number(url.searchParams.get("limit") ?? "20");
        return get9GridRanking(env, Number.isFinite(rawLimit) ? rawLimit : 20);
      }
      return json({ error: "Not found" }, { status: 404 }, secure);
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao") {
      if (!env.KAKAO_REST_API_KEY) return json({ error: "Kakao login is not configured" }, { status: 503 }, secure);
      const state = randomHex(32);
      const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", env.KAKAO_REST_API_KEY);
      authorizeUrl.searchParams.set("redirect_uri", env.KAKAO_REDIRECT_URI);
      authorizeUrl.searchParams.set("response_type", "code");
      authorizeUrl.searchParams.set("state", state);
      return new Response(null, { status: 302, headers: { ...securityHeaders(secure), Location: authorizeUrl.toString(), "Set-Cookie": stateCookie(state, secure) } });
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/callback") {
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const savedState = getCookie(request, STATE_COOKIE);
      const error = url.searchParams.get("error");
      const headers = new Headers(securityHeaders(secure));
      headers.append("Set-Cookie", clearCookie(STATE_COOKIE, secure));
      if (error === "access_denied") return json({ error: "Kakao login was cancelled" }, { status: 400, headers }, secure);
      if (!code || !returnedState || !savedState || returnedState !== savedState) return json({ error: "Invalid OAuth state or authorization code" }, { status: 400, headers }, secure);
      if (!env.KAKAO_REST_API_KEY) return json({ error: "Kakao login is not configured" }, { status: 503, headers }, secure);
      try {
        const tokenBody = new URLSearchParams({ grant_type: "authorization_code", client_id: env.KAKAO_REST_API_KEY, redirect_uri: env.KAKAO_REDIRECT_URI, code });
        if (env.KAKAO_CLIENT_SECRET) tokenBody.set("client_secret", env.KAKAO_CLIENT_SECRET);
        const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: tokenBody });
        if (!tokenResponse.ok) return kakaoError(headers, secure, requestId, "token", tokenResponse.status);
        const token = await tokenResponse.json() as KakaoTokenResponse;
        if (!token.access_token) return kakaoError(headers, secure, requestId, "token_response");
        const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${token.access_token}` } });
        if (!userResponse.ok) return kakaoError(headers, secure, requestId, "user_info", userResponse.status);
        const kakaoUser = await userResponse.json() as KakaoUserResponse;
        if (typeof kakaoUser.id !== "number") return kakaoError(headers, secure, requestId, "user_response");
        const user = await getOrCreateUser(env.DB, String(kakaoUser.id));
        const sessionId = await createSession(env.DB, user.id);
        headers.append("Set-Cookie", sessionCookie(sessionId, secure));
        return json({ authenticated: true, provider: "kakao", user: { id: user.id } }, { headers }, secure);
      } catch (error) {
        logError("kakao.authentication_exception", error, context);
        return json({ error: "Kakao authentication failed" }, { status: 502, headers }, secure);
      }
    }

    if (request.method === "GET" && url.pathname === "/api/me") {
      const sessionId = getCookie(request, SESSION_COOKIE);
      if (!sessionId) return json({ error: "Unauthorized" }, { status: 401 }, secure);
      try {
        const user = await getSessionUser(env.DB, sessionId);
        if (!user) return json({ error: "Unauthorized" }, { status: 401, headers: { "Set-Cookie": clearCookie(SESSION_COOKIE, secure) } }, secure);
        return json({ authenticated: true, user: { id: user.id, nickname: user.nickname, profile_image_url: user.profile_image_url } }, {}, secure);
      } catch (error) { logError("auth.session_lookup_failed", error, context); return json({ error: "Authentication service unavailable" }, { status: 503 }, secure); }
    }

    if (request.method === "DELETE" && url.pathname === "/api/account") {
      let user: UserRow | null;
      try { user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); }
      catch (error) { logError("auth.account_delete_user_lookup_failed", error, context); return json({ error: "Authentication service unavailable" }, { status: 503 }, secure); }
      if (!user) return json({ error: "Unauthorized" }, { status: 401 }, secure);
      const body = await parseJsonBody(request);
      if (body?.confirmation !== "DELETE") return json({ error: "Account deletion requires confirmation" }, { status: 400 }, secure);
      try { await deleteAccount(env.DB, user.id); logInfo("account.deleted", { request_id: requestId }); return json({ deleted: true }, { headers: { "Set-Cookie": clearCookie(SESSION_COOKIE, secure) } }, secure); }
      catch (error) { logError("account.delete_failed", error, context); return json({ error: "Account deletion service unavailable" }, { status: 503 }, secure); }
    }

    if (url.pathname === "/api/settings" || url.pathname.startsWith("/api/settings/")) {
      let user: UserRow | null;
      try { user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); }
      catch (error) { logError("auth.settings_user_lookup_failed", error, context); return json({ error: "Authentication service unavailable" }, { status: 503 }, secure); }
      if (!user) return json({ error: "Unauthorized" }, { status: 401 }, secure);
      if (request.method === "GET" && url.pathname === "/api/settings") {
        try {
          const result = await env.DB.prepare(`SELECT setting_key, setting_value FROM user_settings WHERE user_id = ? ORDER BY setting_key`).bind(user.id).all<SettingRow>();
          const settings: Record<string, string> = {};
          for (const row of result.results) settings[row.setting_key] = row.setting_value;
          return json({ settings }, {}, secure);
        } catch (error) { logError("settings.list_failed", error, context); return json({ error: "Settings service unavailable" }, { status: 503 }, secure); }
      }
      const key = parseSettingKey(url.pathname);
      if (!key) return json({ error: "Invalid setting key" }, { status: 400 }, secure);
      if (request.method === "GET") {
        try {
          const row = await env.DB.prepare(`SELECT setting_key, setting_value FROM user_settings WHERE user_id = ? AND setting_key = ? LIMIT 1`).bind(user.id, key).first<SettingRow>();
          if (!row) return json({ error: "Setting not found" }, { status: 404 }, secure);
          return json({ key: row.setting_key, value: row.setting_value }, {}, secure);
        } catch (error) { logError("settings.get_failed", error, context); return json({ error: "Settings service unavailable" }, { status: 503 }, secure); }
      }
      if (request.method === "PUT") {
        const body = await parseJsonBody(request);
        if (!body || typeof body.value !== "string" || body.value.length > MAX_SETTING_VALUE_LENGTH) return json({ error: "Invalid setting value" }, { status: 400 }, secure);
        try { await env.DB.prepare(`INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`).bind(user.id, key, body.value).run(); return json({ key, value: body.value }, {}, secure); }
        catch (error) { logError("settings.put_failed", error, context); return json({ error: "Settings service unavailable" }, { status: 503 }, secure); }
      }
      if (request.method === "DELETE") {
        try { await env.DB.prepare("DELETE FROM user_settings WHERE user_id = ? AND setting_key = ?").bind(user.id, key).run(); return new Response(null, { status: 204, headers: securityHeaders(secure) }); }
        catch (error) { logError("settings.delete_failed", error, context); return json({ error: "Settings service unavailable" }, { status: 503 }, secure); }
      }
      return json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "GET, PUT, DELETE" } }, secure);
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      const sessionId = getCookie(request, SESSION_COOKIE);
      if (sessionId) {
        try { const sessionHash = await hashSessionId(sessionId); await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionHash).run(); }
        catch (error) { logError("auth.logout_failed", error, context); return json({ error: "Logout service unavailable" }, { status: 503 }, secure); }
      }
      return json({ logged_out: true }, { headers: { "Set-Cookie": clearCookie(SESSION_COOKIE, secure) } }, secure);
    }

    return json({ error: "Not found" }, { status: 404 }, secure);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    try { await cleanupExpiredSessions(env.DB); }
    catch (error) { logError("sessions.cleanup_failed", error, { job: "session_cleanup" }); throw error; }
  },
};

export default worker;
