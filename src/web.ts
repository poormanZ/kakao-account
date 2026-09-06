import type { GameCatalogItem } from "./game-catalog";

export interface WebUser { id: number; nickname: string | null; profile_image_url: string | null; }

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

const profileMarkup = (user: WebUser, small = false): string => {
  const imageUrl = user.profile_image_url?.startsWith("https:") ? user.profile_image_url : null;
  const cls = small ? "mini-avatar" : "avatar";
  return imageUrl ? `<img class="${cls}" src="${escapeHtml(imageUrl)}" alt="프로필 이미지">` : `<div class="${cls} avatar-placeholder">K</div>`;
};

const styles = `
:root { color-scheme: light; font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
* { box-sizing: border-box; } body { margin:0; min-height:100vh; background:#f5f6f8; color:#191919; } a { color:inherit; }
.topbar { min-height:64px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:0 max(16px,calc((100vw - 1120px)/2)); background:#fff; border-bottom:1px solid #e7e7e7; }
.brand { font-weight:900; text-decoration:none; letter-spacing:-.03em; } .user-area { display:flex; align-items:center; gap:10px; font-size:14px; }
.mini-avatar { width:32px; height:32px; border-radius:50%; object-fit:cover; background:#eee; } .user-link,.login-link { text-decoration:none; font-weight:700; }
.login-link { display:inline-block; padding:9px 13px; border-radius:9px; background:#fee500; } .logout-link { border:0; background:transparent; color:#777; cursor:pointer; font:inherit; padding:8px; }
main { width:min(92vw,1120px); margin:0 auto; padding:42px 0 64px; } .hero { margin-bottom:30px; } .eyebrow { margin:0 0 8px; color:#777; font-size:13px; font-weight:800; letter-spacing:.08em; }
h1 { margin:0 0 10px; font-size:clamp(30px,5vw,44px); letter-spacing:-.04em; } .subtitle { margin:0; color:#666; font-size:16px; }
.section-title { margin:0 0 16px; font-size:21px; } .game-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
.game-card { display:flex; min-height:260px; flex-direction:column; padding:24px; background:#fff; border:1px solid #e5e5e5; border-radius:18px; box-shadow:0 8px 24px rgba(0,0,0,.05); }
.game-icon { display:grid; width:56px; height:56px; place-items:center; margin-bottom:20px; border-radius:14px; background:#f1f2f4; font-size:25px; font-weight:900; }
.game-card h3 { margin:0 0 8px; font-size:21px; } .game-card p { margin:0; color:#666; line-height:1.55; } .status { display:inline-flex; width:max-content; margin-top:14px; padding:5px 8px; border-radius:999px; background:#f1f1f1; color:#777; font-size:12px; font-weight:800; }
.card-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:auto; padding-top:24px; } .action { display:block; padding:11px 12px; border-radius:10px; text-align:center; text-decoration:none; font-size:14px; font-weight:800; }
.action.primary { background:#191919; color:#fff; } .action.secondary { border:1px solid #ddd; background:#fff; } .action.disabled { color:#aaa; border:1px solid #eee; background:#fafafa; pointer-events:none; }
.notice { margin-top:28px; padding:16px 18px; border:1px dashed #d7d7d7; border-radius:12px; color:#777; background:rgba(255,255,255,.65); font-size:14px; }
.error-box { margin-bottom:20px; padding:12px 14px; border-radius:10px; background:#fff0f0; color:#b42318; font-size:14px; }
.account-card { width:min(92vw,460px); margin:0 auto; background:#fff; border:1px solid #e7e7e7; border-radius:20px; padding:32px; box-shadow:0 12px 36px rgba(0,0,0,.08); }
.profile { display:flex; align-items:center; gap:14px; margin-bottom:28px; } .avatar { width:56px; height:56px; border-radius:50%; object-fit:cover; background:#f0f0f0; } .avatar-placeholder { display:grid; place-items:center; font-size:22px; font-weight:800; }
.user-id { color:#888; font-size:13px; margin-top:3px; } label { display:block; font-size:14px; font-weight:700; margin-bottom:8px; } .row { display:flex; gap:8px; }
input { min-width:0; flex:1; padding:13px 14px; border:1px solid #ddd; border-radius:10px; font-size:15px; outline:none; } input:focus { border-color:#999; box-shadow:0 0 0 3px rgba(0,0,0,.06); }
button { padding:13px 16px; border:0; border-radius:10px; background:#191919; color:#fff; font-weight:700; cursor:pointer; } button:disabled { opacity:.55; cursor:wait; }
.message { min-height:22px; margin:10px 0 0; font-size:14px; } .message.error { color:#d93025; } .message.success { color:#188038; } .logout { width:100%; margin-top:24px; background:#fff; color:#555; border:1px solid #ddd; } .hint { margin-top:8px; color:#888; font-size:12px; }
@media (max-width:780px) { .game-grid { grid-template-columns:1fr; } main { padding-top:30px; } .user-name { display:none; } }
`;

const shell = (title: string, content: string, user: WebUser | null): string => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body><header class="topbar"><a class="brand" href="/">MINI GAME PORTAL</a><div class="user-area">${user ? `${profileMarkup(user,true)}<a class="user-link user-name" href="/account">${escapeHtml(user.nickname || "닉네임 미설정")}</a><a class="user-link" href="/account">내 정보</a><button class="logout-link" id="logoutButton" type="button">로그아웃</button>` : `<a class="login-link" href="/auth/kakao">카카오로 로그인</a>`}</div></header>${content}${user ? `<script>document.getElementById("logoutButton")?.addEventListener("click",async()=>{const b=document.getElementById("logoutButton");b.disabled=true;try{const r=await fetch("/auth/logout",{method:"POST"});if(r.ok)location.href="/";else b.disabled=false}catch{b.disabled=false}});</script>` : ""}</body></html>`;

export const renderPortalPage = (user: WebUser | null, games: GameCatalogItem[], error?: string | null): string => {
  const cards = games.slice().sort((a,b)=>a.sort_order-b.sort_order).map((game)=>{
    const play = game.status === "active" ? `<a class="action primary" href="/games/${encodeURIComponent(game.slug)}">게임 시작</a>` : `<span class="action disabled">준비 중</span>`;
    const ranking = game.ranking_enabled ? `<a class="action secondary" href="/games/${encodeURIComponent(game.slug)}/ranking">랭킹 보기</a>` : `<span class="action disabled">랭킹 없음</span>`;
    return `<article class="game-card"><div class="game-icon" aria-hidden="true">${escapeHtml(game.icon)}</div><h3>${escapeHtml(game.name)}</h3><p>${escapeHtml(game.description)}</p>${game.status === "coming_soon" ? `<span class="status">COMING SOON</span>` : ""}<div class="card-actions">${play}${ranking}</div></article>`;
  }).join("");
  return shell("미니게임 포털",`<main><section class="hero"><p class="eyebrow">PLAY · COMPETE · RANK</p><h1>미니게임 포털</h1><p class="subtitle">짧게 즐기고, 점수를 기록하고, 랭킹에 도전하세요.</p></section>${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ""}<section><h2 class="section-title">게임 선택</h2><div class="game-grid">${cards}</div><div class="notice">게임과 랭킹은 준비되는 순서대로 활성화됩니다. 로그인하지 않아도 게임 목록과 랭킹을 둘러볼 수 있으며, 점수 기록은 로그인 후 사용할 수 있습니다.</div></section></main>`,user);
};

export const renderGamePlaceholderPage = (user: WebUser | null, game: GameCatalogItem, ranking = false): string => shell(ranking ? `${game.name} 랭킹` : game.name,`<main><section class="hero"><p class="eyebrow">${ranking ? "RANKING" : "GAME"}</p><h1>${escapeHtml(ranking ? `${game.name} 랭킹` : game.name)}</h1><p class="subtitle">${escapeHtml(game.description)}</p></section><div class="notice">${ranking ? "랭킹 데이터 모델과 점수 검증을 구현한 뒤 실제 순위가 표시됩니다." : "게임 플레이 화면은 다음 구현 단계에서 연결됩니다."}</div><p style="margin-top:20px"><a class="action secondary" href="/">← 게임 목록으로</a></p></main>`,user);

export const renderAccountPage = (user: WebUser | null, error?: string | null): string => {
  if (!user) return shell("내 정보",`<main><section class="account-card"><h1>내 정보</h1><p class="subtitle">로그인 후 계정 정보를 관리할 수 있습니다.</p>${error ? `<div class="error-box">${escapeHtml(error)}</div>` : ""}<p><a class="login-link" href="/auth/kakao">카카오로 로그인</a></p></section></main>`,null);
  const nickname = user.nickname ?? "";
  return shell("내 정보",`<main><section class="account-card"><h1>내 정보</h1><p class="subtitle">로그인 계정 관리</p><div class="profile">${profileMarkup(user)}<div><strong id="currentNickname">${escapeHtml(nickname || "닉네임 미설정")}</strong><div class="user-id">사용자 #${user.id}</div></div></div><form id="nicknameForm"><label for="nickname">닉네임</label><div class="row"><input id="nickname" maxlength="20" minlength="2" value="${escapeHtml(nickname)}" placeholder="2~20자 닉네임" autocomplete="nickname" required><button id="saveButton" type="submit">저장</button></div><div class="hint">공백만 입력할 수 없으며, 이미 사용 중인 닉네임은 사용할 수 없습니다.</div><p id="message" class="message" aria-live="polite"></p></form><button id="logoutAccountButton" class="logout" type="button">로그아웃</button><p style="margin-top:20px"><a href="/">← 게임 목록으로</a></p><script>
const f=document.getElementById("nicknameForm"),i=document.getElementById("nickname"),b=document.getElementById("saveButton"),c=document.getElementById("currentNickname"),m=document.getElementById("message"),l=document.getElementById("logoutAccountButton");const msg=(t,k)=>{m.textContent=t;m.className="message "+k};f.addEventListener("submit",async e=>{e.preventDefault();const nickname=i.value.trim();if(nickname.length<2||nickname.length>20){msg("닉네임은 2~20자로 입력해주세요.","error");return}b.disabled=true;try{const r=await fetch("/api/profile/nickname",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({nickname})});const d=await r.json().catch(()=>({}));if(r.status===409){msg("이미 사용 중인 닉네임입니다.","error");return}if(!r.ok){msg(d.error||"닉네임을 저장하지 못했습니다.","error");return}i.value=d.nickname;c.textContent=d.nickname;msg("닉네임이 저장되었습니다.","success")}catch{msg("네트워크 오류가 발생했습니다.","error")}finally{b.disabled=false}});l.addEventListener("click",async()=>{l.disabled=true;try{const r=await fetch("/auth/logout",{method:"POST"});if(r.ok)location.href="/";else l.disabled=false}catch{l.disabled=false}});
</script></section></main>`,user);
};
