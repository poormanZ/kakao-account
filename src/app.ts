import worker, { type Env } from "./index";
import { getAuthenticatedUser, getCookie, hashSessionId, type AuthUser } from "./auth";
import { GAME_CATALOG } from "./game-catalog";
import { render9GridPage } from "./9grid-ui";
import { renderClickRushPage } from "./click-rush";
import { getClickRushBest, getClickRushRanking, getClickRushUserRank, submitClickRushScore } from "./click-rush-api";
import { renderClickRushRankingPage } from "./click-rush-ranking";
import { renderReactionTestPage } from "./reaction-test";
import { renderReactionTestRankingPage } from "./reaction-test-ranking";
import { getReactionTestBest, getReactionTestRanking, getReactionTestUserRank, submitReactionTestScore } from "./reaction-test-api";
import { logError, logWarn } from "./logger";
import { renderAccountPage, renderGamePlaceholderPage, renderPortalPage } from "./web";

const SESSION_COOKIE = "kakao_account_session";
const STATE_COOKIE = "kakao_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_NICKNAME_LENGTH = 20;
const MIN_NICKNAME_LENGTH = 2;
interface KakaoTokenResponse { access_token?: string; }
interface KakaoUserResponse { id?: number; properties?: { nickname?: string }; kakao_account?: { profile?: { nickname?: string } } }
const hasControlCharacters = (value: string): boolean => Array.from(value).some((character) => { const code = character.charCodeAt(0); return code < 32 || code === 127; });
const parseJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => { const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase(); if (contentType !== "application/json") return null; try { const body = await request.json(); return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null; } catch { return null; } };
const htmlHeaders = (): Headers => new Headers({ "Content-Type": "text/html; charset=UTF-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" });
const apiJson = (data: unknown, status = 200): Response => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" } });
const page = (html: string): Response => new Response(html, { status: 200, headers: htmlHeaders() });
const cookie = (name: string, value: string, maxAge: number, secure: boolean): string => `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
const getKakaoNickname = (user: KakaoUserResponse): string | null => { const nickname = user.properties?.nickname ?? user.kakao_account?.profile?.nickname; if (!nickname) return null; const value = nickname.trim(); return value.length >= MIN_NICKNAME_LENGTH && value.length <= MAX_NICKNAME_LENGTH && !hasControlCharacters(value) ? value : null; };
const createServiceSession = async (db: D1Database, userId: number): Promise<string> => { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); const sessionId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); const sessionHash = await hashSessionId(sessionId); const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(); await db.prepare("INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(sessionHash, userId, expiresAt).run(); return sessionId; };
const completeKakaoLogin = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url); const secure = url.protocol === "https:"; const state = getCookie(request, STATE_COOKIE); const returnedState = url.searchParams.get("state"); const code = url.searchParams.get("code"); const error = url.searchParams.get("error");
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer", "Set-Cookie": cookie(STATE_COOKIE, "", 0, secure) });
  if (error || !code || !returnedState || !state || returnedState !== state) { if (error === "access_denied") logWarn("kakao.login_cancelled", { route: url.pathname, method: request.method }); headers.set("Location", `${new URL("/", env.APP_BASE_URL).toString()}?error=auth`); return new Response(null, { status: 302, headers }); }
  if (!env.KAKAO_REST_API_KEY) { headers.set("Location", `${new URL("/", env.APP_BASE_URL).toString()}?error=auth`); return new Response(null, { status: 302, headers }); }
  try {
    const tokenBody = new URLSearchParams({ grant_type: "authorization_code", client_id: env.KAKAO_REST_API_KEY, redirect_uri: env.KAKAO_REDIRECT_URI, code }); if (env.KAKAO_CLIENT_SECRET) tokenBody.set("client_secret", env.KAKAO_CLIENT_SECRET);
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: tokenBody }); if (!tokenResponse.ok) throw new Error("Kakao token request failed");
    const token = await tokenResponse.json() as KakaoTokenResponse; if (!token.access_token) throw new Error("Kakao token response missing access token");
    const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", { headers: { Authorization: `Bearer ${token.access_token}` } }); if (!userResponse.ok) throw new Error("Kakao user request failed");
    const kakaoUser = await userResponse.json() as KakaoUserResponse; if (typeof kakaoUser.id !== "number") throw new Error("Kakao user response missing id");
    const kakaoNickname = getKakaoNickname(kakaoUser);
    await env.DB.prepare("INSERT OR IGNORE INTO users (kakao_user_id, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(String(kakaoUser.id)).run();
    const user = await env.DB.prepare("SELECT id, nickname, profile_image_url FROM users WHERE kakao_user_id = ? LIMIT 1").bind(String(kakaoUser.id)).first<AuthUser>(); if (!user) throw new Error("Failed to load user");
    if (!user.nickname && kakaoNickname) await env.DB.prepare("UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND nickname IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE nickname = ? AND id != ?)").bind(kakaoNickname, user.id, kakaoNickname, user.id).run();
    headers.append("Set-Cookie", cookie(SESSION_COOKIE, await createServiceSession(env.DB, user.id), SESSION_TTL_SECONDS, secure)); headers.set("Location", new URL("/", env.APP_BASE_URL).toString()); return new Response(null, { status: 302, headers });
  } catch (error) { logError("kakao.web_authentication_exception", error, { route: url.pathname, method: request.method }); headers.set("Location", `${new URL("/", env.APP_BASE_URL).toString()}?error=auth`); return new Response(null, { status: 302, headers }); }
};
const durationFromRequest = (url: URL): number => Number(url.searchParams.get("duration") || "20");
const app = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); const error = url.searchParams.get("error") === "auth" ? "카카오 로그인에 실패했습니다. 다시 시도해주세요." : null; return page(renderPortalPage(user, GAME_CATALOG, error)); } catch (error) { logError("web.portal_page_failed", error, { route: "/", method: "GET" }); return page(renderPortalPage(null, GAME_CATALOG, "서비스 정보를 불러오지 못했습니다.")); } }
    if (request.method === "GET" && url.pathname === "/account") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return page(renderAccountPage(user, "로그인이 필요합니다.")); } catch (error) { logError("web.account_page_failed", error, { route: "/account", method: request.method }); return page(renderAccountPage(null, "계정 정보를 불러오지 못했습니다.")); } }
    if (request.method === "GET" && url.pathname === "/games/9grid") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return render9GridPage(user); } catch (error) { logError("web.9grid_page_failed", error, { route: url.pathname, method: request.method }); return render9GridPage(null); } }
    if (request.method === "GET" && url.pathname === "/games/click-rush") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return page(renderClickRushPage(user)); } catch (error) { logError("web.click_rush_page_failed", error, { route: url.pathname, method: request.method }); return page(renderClickRushPage(null)); } }
    if (request.method === "GET" && url.pathname === "/games/reaction") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return page(renderReactionTestPage(user)); } catch (error) { logError("web.reaction_test_page_failed", error, { route: url.pathname, method: request.method }); return page(renderReactionTestPage(null)); } }
    if (request.method === "GET" && url.pathname === "/games/click-rush/ranking") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return page(renderClickRushRankingPage(user)); } catch (error) { logError("web.click_rush_ranking_page_failed", error, { route: url.pathname, method: request.method }); return page(renderClickRushRankingPage(null)); } }
    if (request.method === "GET" && url.pathname === "/games/reaction/ranking") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return page(renderReactionTestRankingPage(user)); } catch (error) { logError("web.reaction_test_ranking_page_failed", error, { route: url.pathname, method: request.method }); return page(renderReactionTestRankingPage(null)); } }
    if (request.method === "POST" && url.pathname === "/api/games/click-rush/scores") { let user: AuthUser | null; try { user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); } catch (error) { logError("game.score_user_lookup_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Authentication service unavailable" }, 503); } const body = await parseJsonBody(request); return submitClickRushScore(env.GAME_DB, user, body); }
    if (request.method === "GET" && url.pathname === "/api/games/click-rush/ranking") { try { return getClickRushRanking(env.GAME_DB, env.DB, durationFromRequest(url)); } catch (error) { logError("game.ranking_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Ranking service unavailable" }, 503); } }
    if (request.method === "GET" && url.pathname === "/api/games/click-rush/best") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return getClickRushBest(env.GAME_DB, user, durationFromRequest(url)); } catch (error) { logError("game.best_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Score service unavailable" }, 503); } }
    if (request.method === "GET" && url.pathname === "/api/games/click-rush/my-rank") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return getClickRushUserRank(env.GAME_DB, user, durationFromRequest(url)); } catch (error) { logError("game.my_rank_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Ranking service unavailable" }, 503); } }
    if (request.method === "POST" && url.pathname === "/api/games/reaction/scores") { let user: AuthUser | null; try { user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); } catch (error) { logError("reaction.score_user_lookup_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Authentication service unavailable" }, 503); } const body = await parseJsonBody(request); return submitReactionTestScore(env.GAME_DB, user, body); }
    if (request.method === "GET" && url.pathname === "/api/games/reaction/ranking") { try { return getReactionTestRanking(env.GAME_DB, env.DB); } catch (error) { logError("reaction.ranking_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Ranking service unavailable" }, 503); } }
    if (request.method === "GET" && url.pathname === "/api/games/reaction/best") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return getReactionTestBest(env.GAME_DB, user); } catch (error) { logError("reaction.best_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Score service unavailable" }, 503); } }
    if (request.method === "GET" && url.pathname === "/api/games/reaction/my-rank") { try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return getReactionTestUserRank(env.GAME_DB, user); } catch (error) { logError("reaction.my_rank_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Ranking service unavailable" }, 503); } }
    const gameMatch = url.pathname.match(/^\/games\/([^/]+)(?:\/ranking)?$/);
    if (request.method === "GET" && gameMatch) { const game = GAME_CATALOG.find((item) => item.slug === decodeURIComponent(gameMatch[1])); if (!game) return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=UTF-8" } }); const ranking = url.pathname.endsWith("/ranking"); try { const user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); return page(renderGamePlaceholderPage(user, game, ranking)); } catch { return page(renderGamePlaceholderPage(null, game, ranking)); } }
    if (request.method === "PUT" && url.pathname === "/api/profile/nickname") {
      let user: AuthUser | null; try { user = await getAuthenticatedUser(request, env.DB, SESSION_COOKIE); } catch (error) { logError("profile.nickname_user_lookup_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Authentication service unavailable" }, 503); }
      if (!user) return apiJson({ error: "Unauthorized" }, 401); const body = await parseJsonBody(request); const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
      if (nickname.length < MIN_NICKNAME_LENGTH || nickname.length > MAX_NICKNAME_LENGTH || hasControlCharacters(nickname)) return apiJson({ error: "Nickname must be 2-20 characters" }, 400);
      try { const existing = await env.DB.prepare("SELECT id FROM users WHERE nickname = ? LIMIT 1").bind(nickname).first<{ id: number }>(); if (existing && existing.id !== user.id) return apiJson({ error: "Nickname already in use" }, 409); await env.DB.prepare("UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(nickname, user.id).run(); return apiJson({ nickname }); } catch (error) { if (error instanceof Error && /unique|constraint/i.test(error.message)) return apiJson({ error: "Nickname already in use" }, 409); logError("profile.nickname_update_failed", error, { route: url.pathname, method: request.method }); return apiJson({ error: "Profile service unavailable" }, 503); }
    }
    if (request.method === "GET" && url.pathname === "/auth/kakao/callback") return completeKakaoLogin(request, env);
    return worker.fetch(request, env);
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> { return worker.scheduled(controller, env); },
};
export default app;
