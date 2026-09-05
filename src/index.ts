export interface Env {
  DB: D1Database;
  APP_BASE_URL: string;
  KAKAO_REDIRECT_URI: string;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
    ...init,
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "kakao-account-api" });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({ service: "kakao-account-api", status: "ready" });
    }

    return json({ error: "Not Found" }, { status: 404 });
  },
};
