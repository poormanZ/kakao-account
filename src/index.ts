export interface Env {
  DB: D1Database;
  APP_BASE_URL: string;
  KAKAO_REDIRECT_URI: string;
  KAKAO_REST_API_KEY?: string;
  KAKAO_CLIENT_SECRET?: string;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
    ...init,
  });

const randomState = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
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

const stateCookie = (state: string, secure: boolean): string =>
  `kakao_oauth_state=${encodeURIComponent(state)}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

const clearStateCookie = (secure: boolean): string =>
  `kakao_oauth_state=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;

interface KakaoTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

interface KakaoUserResponse {
  id?: number;
}

const kakaoError = (status = 502) =>
  json({ error: "Kakao authentication failed" }, { status });

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
      if (!env.KAKAO_REST_API_KEY) {
        return json({ error: "Kakao login is not configured" }, { status: 503 });
      }

      const state = randomState();
      const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", env.KAKAO_REST_API_KEY);
      authorizeUrl.searchParams.set("redirect_uri", env.KAKAO_REDIRECT_URI);
      authorizeUrl.searchParams.set("response_type", "code");

      return new Response(null, {
        status: 302,
        headers: {
          Location: authorizeUrl.toString(),
          "Set-Cookie": stateCookie(state, secure),
          "Cache-Control": "no-store",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/auth/kakao/callback") {
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const savedState = getCookie(request, "kakao_oauth_state");
      const error = url.searchParams.get("error");

      const headers = new Headers({
        "Cache-Control": "no-store",
        "Set-Cookie": clearStateCookie(secure),
      });

      if (error === "access_denied") {
        return json({ error: "Kakao login was cancelled" }, { status: 400, headers });
      }

      if (!code || !returnedState || !savedState || returnedState !== savedState) {
        return json({ error: "Invalid OAuth state or authorization code" }, { status: 400, headers });
      }

      if (!env.KAKAO_REST_API_KEY) {
        return json({ error: "Kakao login is not configured" }, { status: 503, headers });
      }

      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.KAKAO_REST_API_KEY,
        redirect_uri: env.KAKAO_REDIRECT_URI,
        code,
      });
      if (env.KAKAO_CLIENT_SECRET) {
        tokenBody.set("client_secret", env.KAKAO_CLIENT_SECRET);
      }

      const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: tokenBody,
      });

      if (!tokenResponse.ok) return kakaoError();

      const token = (await tokenResponse.json()) as KakaoTokenResponse;
      if (!token.access_token) return kakaoError();

      const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!userResponse.ok) return kakaoError();

      const user = (await userResponse.json()) as KakaoUserResponse;
      if (typeof user.id !== "number") return kakaoError();

      return json(
        { authenticated: true, provider: "kakao" },
        { headers },
      );
    }

    return json({ error: "Not Found" }, { status: 404 });
  },
};
