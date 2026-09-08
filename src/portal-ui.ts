import type { AuthUser } from "./auth";

const esc = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
      })[char] ?? char,
  );

export const renderPortalPage = (
  user: AuthUser | null,
  best: {
    max_round: number;
    last_round_clear_turn: number;
    remaining_hp: number;
  } | null,
): Response => {
  const userLabel = user?.nickname
    ? esc(user.nickname)
    : user
      ? `USER #${user.id}`
      : "GUEST";
  const score = best
    ? `BEST ROUND ${best.max_round} · HP ${best.remaining_hp}`
    : "NO RECORD";
  const authAction = user
    ? '<form method="post" action="/auth/logout"><button type="submit">LOGOUT</button></form>'
    : '<a class="login" href="/auth/kakao">KAKAO LOGIN</a>';

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Kakao Mini Games</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      background: #080b0d;
      color: #d7e0e5;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(circle at top, #142027 0, #080b0d 60%);
      padding: 18px;
    }
    .app {
      max-width: 1100px;
      margin: auto;
      border: 1px solid #40515a;
      background: #0b1013;
      box-shadow: 0 0 35px #000;
      padding: 18px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      border-bottom: 1px solid #40515a;
      padding-bottom: 14px;
    }
    .brand { font-weight: 800; letter-spacing: 2px; }
    .muted { color: #83939c; font-size: 12px; }
    .user { display: flex; align-items: center; gap: 10px; }
    a, button {
      font: inherit;
      color: #d7e0e5;
      text-decoration: none;
      background: #111a1e;
      border: 1px solid #52636c;
      padding: 9px 12px;
      cursor: pointer;
    }
    .hero { padding: 38px 10px 30px; }
    .hero h1 {
      font-size: clamp(28px, 6vw, 54px);
      margin: 0 0 8px;
      letter-spacing: 3px;
    }
    .hero p { color: #83939c; margin: 0; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .card {
      border: 1px solid #40515a;
      background: #0d1317;
      padding: 18px;
      min-height: 220px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .forge-card {
      border-color: #80633b;
      background: linear-gradient(145deg, #15120e, #0d1317 55%);
    }
    .icon {
      font-size: 30px;
      border: 1px dashed #52636c;
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
    }
    .forge-card .icon {
      border-color: #80633b;
    }
    .card h2 { margin: 16px 0 6px; letter-spacing: 1px; }
    .card p { color: #83939c; line-height: 1.6; font-size: 13px; }
    .score { font-size: 12px; color: #aebdc5; margin: 14px 0; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .play { font-weight: 800; }
    .footer {
      margin-top: 22px;
      padding-top: 14px;
      border-top: 1px solid #26353c;
      color: #60717a;
      font-size: 11px;
    }
    @media (max-width: 600px) {
      body { padding: 8px; }
      .app { padding: 10px; }
      .top { align-items: flex-start; flex-direction: column; }
      .user { width: 100%; justify-content: space-between; }
      .hero { padding: 28px 4px 22px; }
    }
  </style>
</head>
<body>
  <main class="app">
    <header class="top">
      <div>
        <div class="brand">KAKAO MINI GAMES</div>
        <div class="muted">terminal://portal</div>
      </div>
      <div class="user">
        <span class="muted">${userLabel}</span>
        ${authAction}
      </div>
    </header>

    <section class="hero">
      <h1>GAME PORTAL</h1>
      <p>작은 게임을 플레이하고 기록을 남겨보세요.</p>
    </section>

    <section class="grid" aria-label="미니게임 목록">
      <article class="card forge-card" id="forge-game-card">
        <div>
          <div class="icon" aria-hidden="true">⚒</div>
          <h2>FORGE</h2>
          <p>대장간에서 무기를 구매하고 강화해 피해량을 키우세요. 강화에 실패하면 무기가 파괴됩니다.</p>
          <div class="score">SERVER RNG · GOLD ECONOMY · +0 → +10</div>
        </div>
        <div class="actions">
          <a class="play" href="/forge">PLAY FORGE →</a>
        </div>
      </article>

      <article class="card" id="9grid-game-card">
        <div>
          <div class="icon">9×9</div>
          <h2>9GRID</h2>
          <p>3×3 카드 보드에서 속성과 직업 시너지를 조합하며 몬스터를 버티는 턴제 서바이벌.</p>
          <div class="score">${score}</div>
        </div>
        <div class="actions">
          <a class="play" href="/9grid">PLAY 9GRID →</a>
          <a href="/9grid#ranking">RANKING</a>
        </div>
      </article>
    </section>

    <div class="footer">
      ACCOUNT: ${user ? "AUTHENTICATED" : "GUEST"} · Kakao account session · GAME PORTAL
    </div>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
};
