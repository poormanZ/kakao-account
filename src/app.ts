import worker, { type Env } from "./index";
import { getAuthenticatedUser, getCookie, hashSessionId, type AuthUser } from "./auth";
import { logError, logWarn } from "./logger";
import { renderAccountPage } from "./web";

const SESSION_COOKIE = "kakao_account_session";
const STATE_COOKIE = "kakao_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_NICKNAME_LENGTH = 20;
const MIN_NICKNAME_LENGTH = 2;

interface KakaoTokenResponse { access_token?: string; }
interface KakaoUserResponse {
  id?: number;
  properties?: { nickname?: string };
  kakao_account?: { profile?: { nickname?: string } };
}

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

const copyHeaders = (source: Headers): Headers => {
  const target = new Headers();
  const sourceWithGetCookie = source as Headers & { getSetCookie?: () => string[] };
  const setCookies = sourceWithGetCookie.getSetCookie?.();
  if (setCookies) for (const value of setCookies) target.append("Set-Cookie", value);
  source.forEach((value, key) => {
    if (key !== "set-cookie") target.set(key, value);
  });
  return target;
};

const htmlHeaders = (): Headers => new Headers({
  "Content-Type": "text/html; charset=UTF-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
});

const page = (user: AuthUser | null, error?: string | null): Response =>
  new Response(renderAccountPage(user, error), { status: 200, headers: htmlHeaders() });

const cookie = (name: string, value: string, maxAge: number, secure: boolean): string =>
  `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

const getKakaoNickname = (user: KakaoUserResponse): string | null => {
  const nickname = user.properties?.nickname ?? user.kakao_account?.profile?.nickname;
  if (!nickname) return null;
  const value = nickname.trim();
  if (value.length < MIN_NICKNAME_LENGTH || value.length > MAX_NICKNAME_LENGTH || /[\u0000-\u001F\u007F]/.test(value)) return null;
  return value;
};

const createServiceSession = async (db: D1Database, userId: number): Promise<string> => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const sessionId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const sessionHash = await hashSessionId(sessionId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).bind(sessionHash, userId, expiresAt).run();
  return sessionId;
};

const completeKakaoLogin = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const state = getCookie(request, STATE_COOKIE);
  const returnedState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Set-Cookie": cookie(STATE_COOKIE, "", 0, secure),
  });

  if (error || !code || !returnedState || !state || returnedState !== state) {
    if (error === "access_denied") logWarn("kakao.login_cancelled", { route: url.pathname, method: request.method });
    headers.set("Location", `${new URL("/", env.APP_BASE_URL).toString()}?error=auth`);
    return new Response(null, { status: 302, headers });
  }
  if (!env.KAKAO_REST_API_KEY) {
    headers.set("Location", `${new URL("/", env.APP_BASE_URL).toString()}?error=auth`);
    return new Response(null, { status: 302, headers });
  }

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
    if (!tokenResponse.ok) throw new Error("Kakao token request failed");
    const token = await tokenResponse.json() as KakaoTokenResponse;
    if (!token.access_token) throw new Error("Kakao token response missing access token");

    const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!userResponse.ok) throw new Error("Kakao user request failed");
    const kakaoUser = await userResponse.json() as KakaoUserResponse;
    if (typeof kakaoUser.id !== "number") throw new Error("Kakao user response missing id");

    const kakaoNickname = getKakaoNickname(kakaoUser);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO users (kakao_user_id, created_at, updated_at)
       VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).bind(String(kakaoUser.id)).run();
    const user = await env.DB.prepare(
      `SELECT id, nickname, profile_image_url FROM users WHERE kakao_user_id = ? LIMIT 1`,
    ).bind(String(kakaoUser.id)).first<AuthUser>();
    if (!user) throw new Error("Failed to load user");

    if (!user.nickname && kakaoNickname) {
      await env.DB.prepare(
        `UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND nickname IS NULL
           AND NOT EXISTS (SELECT 1 FROM users WHERE nickname = ? AND id != ?)`,
      ).bind(kakaoNickname, user.id, kakaoNickname, user.id).run();
    }

    const sessionId = await createServiceSession(env.DB, user.id);
    headers.append("Set-Cookie", cookie(SESSION_COOKIE, sessionId, SESSION_TTL_SECONDS, secure));
    headers.set("Location", new URL("/", env.APP_BASE_URL).toString());
    return new Response(null, { status: 302, headers });
  } catch (error) {
    logError("kakao.web_authentication_exception", error, { route: url.pathname, method: request.method });
    headers.set("Location", `${new URL("/", env.APP_BASE_URL).toString()}?error=auth`);
    return new Response(null, { status: 302, headers });
  }
};

const app = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      try {
        const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE);
        const error = url.searchParams.get("error") === "auth" ? "카카오 로그인에 실패했습니다. 다시 시도해주세요." : null;
        return page(user, error);
      } catch (error) {
        logError("web.account_page_failed", error, { route: "/", method: "GET" });
        return page(null, "계정 정보를 불러오지 못했습니다.");
      }
    }

    if (request.method === "PUT" && url.pathname === "/api/profile/nickname") {
      let user: AuthUser | null;
      try {
        user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE);
      } catch (error) {
        logError("profile.nickname_user_lookup_failed", error, { route: url.pathname, method: request.method });
        return Response.json({ error: "Authentication service unavailable" }, { status: 503 });
      }
      if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

      const body = await parseJsonBody(request);
      const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
      if (nickname.length < MIN_NICKNAME_LENGTH || nickname.length > MAX_NICKNAME_LENGTH || /[\u0000-\u001F\u007F]/.test(nickname)) {
        return Response.json({ error: "Nickname must be 2-20 characters" }, { status: 400 });
      }

      try {
        const existing = await env.DB.prepare("SELECT id FROM users WHERE nickname = ? LIMIT 1").bind(nickname).first<{ id: number }>();
        if (existing && existing.id !== user.id) return Response.json({ error: "Nickname already in use" }, { status: 409 });
        await env.DB.prepare("UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(nickname, user.id).run();
        return Response.json({ nickname });
      } catch (error) {
        if (error instanceof Error && /unique|constraint/i.test(error.message)) return Response.json({ error: "Nickname already in use" }, { status: 409 });
        logError("profile.nickname_update_failed", error, { route: url.pathname, method: request.method });
        return Response.json({ error: "Profile service unavailable" }, { status: 503 });
      }
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/callback") {
      return completeKakaoLogin(request, env);
    }

    return worker.fetch(request, env);
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    return worker.scheduled(controller, env);
  },
};

export default app;
