import worker, { type Env } from "./index";
import { getAuthenticatedUser, getCookie, type AuthUser } from "./auth";
import { logError } from "./logger";
import { renderAccountPage } from "./web";

const SESSION_COOKIE = "kakao_account_session";
const MAX_NICKNAME_LENGTH = 20;
const MIN_NICKNAME_LENGTH = 2;

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

const redirectAfterAuth = (request: Request, env: Env, response: Response): Response => {
  const location = new URL("/", env.APP_BASE_URL).toString();
  const headers = copyHeaders(response.headers);
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
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
      if (
        nickname.length < MIN_NICKNAME_LENGTH ||
        nickname.length > MAX_NICKNAME_LENGTH ||
        /[\u0000-\u001F\u007F]/.test(nickname)
      ) {
        return Response.json({ error: "Nickname must be 2-20 characters" }, { status: 400 });
      }

      try {
        const existing = await env.DB.prepare("SELECT id FROM users WHERE nickname = ? LIMIT 1")
          .bind(nickname)
          .first<{ id: number }>();
        if (existing && existing.id !== user.id) {
          return Response.json({ error: "Nickname already in use" }, { status: 409 });
        }

        await env.DB.prepare(
          "UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).bind(nickname, user.id).run();
        return Response.json({ nickname });
      } catch (error) {
        if (error instanceof Error && /unique|constraint/i.test(error.message)) {
          return Response.json({ error: "Nickname already in use" }, { status: 409 });
        }
        logError("profile.nickname_update_failed", error, { route: url.pathname, method: request.method });
        return Response.json({ error: "Profile service unavailable" }, { status: 503 });
      }
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/callback") {
      const response = await worker.fetch(request, env);
      if (response.status === 200) return redirectAfterAuth(request, env, response);
      const headers = copyHeaders(response.headers);
      headers.set("Location", `${new URL("/", env.APP_BASE_URL).toString()}?error=auth`);
      return new Response(null, { status: 302, headers });
    }

    return worker.fetch(request, env);
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    return worker.scheduled(controller, env);
  },
};

export default app;
