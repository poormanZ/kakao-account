import type { AuthUser } from "./auth";

const esc = (value: string): string => value.replace(/[&<>']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
}[char] ?? char));

const userLabel = (user: AuthUser | null): string => (
  user?.nickname ? esc(user.nickname) : user ? `USER #${user.id}` : "GUEST"
);

const cardCss = `
:root{font-family:Georgia,"Times New Roman",serif;color:#252321;background:#141414}
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:18px;background:radial-gradient(circle at top,#393632 0,#161514 58%,#0d0d0c 100%)}
.page{max-width:1280px;margin:0 auto}.toolbar{display:flex;justify-content:flex-end;gap:10px;margin:0 0 14px}.toolbar a{font:700 12px ui-monospace,SFMono-Regular,Consolas,monospace;color:#ddd7ca;text-decoration:none;border:1px solid #625e57;padding:8px 12px;border-radius:5px}.cards{display:grid;grid-template-columns:1fr 1fr;gap:22px}.card{position:relative;overflow:hidden;min-height:760px;padding:42px 48px 34px;border:5px solid #d5cec0;border-radius:22px;background:radial-gradient(circle at 50% 35%,#fbf7ed 0,#eee7d9 68%,#e4dccd 100%);box-shadow:0 20px 45px #0008, inset 0 0 0 1px #514c43}.card:before{content:"";position:absolute;inset:8px;border:2px solid #25231f;border-radius:13px;pointer-events:none}.card:after{content:"";position:absolute;inset:15px;background:repeating-linear-gradient(0deg,#fff0 0,#fff0 5px,#6c655b08 6px);pointer-events:none}.ornament{height:42px;display:flex;align-items:center;gap:14px;position:relative;z-index:1}.rule{height:1px;background:#3b3833;flex:1}.diamond{width:12px;height:12px;border:2px solid #3b3833;transform:rotate(45deg)}
.command{position:relative;z-index:1;margin:58px 0 70px;text-align:center;font-size:clamp(28px,3.1vw,46px);font-weight:700;line-height:1.25;letter-spacing:-1px}.word{display:inline-block;margin:0 4px}.red{color:#c82c2c}.blue{color:#2364ad}.green{color:#287f43}.yellow{color:#c99800}.purple{color:#5c1b87}.label{position:relative;z-index:1;font-size:clamp(21px,2.2vw,30px);font-weight:700;margin:0 0 18px}.slots{position:relative;z-index:1;display:flex;gap:20px;align-items:flex-end;margin:0 0 78px;justify-content:center}.slot{width:78px;height:45px;border:0;border-bottom:5px solid currentColor;background:transparent;text-align:center;font:700 28px Georgia,"Times New Roman",serif;color:#222;outline:none;border-radius:0}.slot:focus{box-shadow:0 5px 0 -3px currentColor}.slot.wide{width:92px}.password-slots{margin-bottom:0}.action{position:relative;z-index:1;display:flex;justify-content:center;margin-top:28px}.enter{border:1px solid #3d3932;border-radius:5px;background:#24211e;color:#f7f0e4;padding:11px 22px;font:700 14px ui-monospace,SFMono-Regular,Consolas,monospace;cursor:pointer}.enter:disabled{opacity:.55;cursor:default}.status{position:relative;z-index:1;min-height:24px;margin-top:14px;text-align:center;font:700 13px ui-monospace,SFMono-Regular,Consolas,monospace}.success{color:#287f43}.failure{color:#9d2525}
.chart-title{position:relative;z-index:1;text-align:center;font-size:clamp(34px,4vw,54px);font-weight:700;margin:28px 0 24px}.chart{position:relative;z-index:1;width:100%;max-width:620px;margin:0 auto}.chart svg{display:block;width:100%;height:auto}.chart-note{position:relative;z-index:1;margin:20px 0 0;text-align:center;font:700 12px ui-monospace,SFMono-Regular,Consolas,monospace;color:#666057}.mobile-note{display:none}
@media(max-width:900px){.cards{grid-template-columns:1fr}.card{min-height:auto;padding:38px 28px 32px}.command{margin:45px 0 55px}.slots{gap:12px;margin-bottom:58px}.mobile-note{display:block}.chart{max-width:700px}}
@media(max-width:520px){body{padding:8px}.card{padding:32px 18px 28px;border-width:4px;border-radius:17px}.card:before{inset:7px}.command{font-size:27px;line-height:1.45;margin:38px 0 48px}.slots{gap:7px}.slot{width:52px;font-size:22px}.slot.wide{width:62px}.label{font-size:20px}.chart-title{font-size:34px}.toolbar{margin-bottom:8px}}
`;

const performanceSvg = (): string => {
  const values = [8, 70, 84, 10, 64, 12, 55, 9, 11, 7, 76, 10];
  const left = 64;
  const right = 650;
  const top = 40;
  const bottom = 390;
  const width = right - left;
  const height = bottom - top;
  const x = (index: number): number => left + (index / 11) * width;
  const y = (value: number): number => bottom - (value / 100) * height;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const gridY = [0, 20, 40, 60, 80, 100].map((value) => `
    <line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="#a9a39a" stroke-width="1" stroke-dasharray="7 6"/>
    <text x="${left - 12}" y="${y(value) + 5}" text-anchor="end" font-size="15" fill="#332f2a">${value}</text>`).join("");
  const gridX = Array.from({ length: 12 }, (_, index) => `
    <line x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${bottom}" stroke="#b7b1a7" stroke-width="1" stroke-dasharray="7 6"/>
    <text x="${x(index)}" y="${bottom + 28}" text-anchor="middle" font-size="15" fill="#332f2a">${index + 1}</text>`).join("");
  const colors: Record<number, string> = { 1: "#c82c2c", 2: "#2364ad", 4: "#287f43", 6: "#c99800", 10: "#5c1b87" };
  const dots = values.map((value, index) => {
    const color = colors[index];
    return `<circle cx="${x(index)}" cy="${y(value)}" r="9" fill="${color ?? "#77736d"}" stroke="#35312d" stroke-width="1"/>`;
  }).join("");
  return `<svg viewBox="0 0 700 455" role="img" aria-label="1부터 12까지의 Performance 그래프"><text x="350" y="18" text-anchor="middle" font-size="12" fill="#766f65">performance graph</text>${gridY}${gridX}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#302d29" stroke-width="2"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#302d29" stroke-width="2"/><polyline points="${points}" fill="none" stroke="#252321" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}<text x="20" y="220" text-anchor="middle" font-size="18" fill="#302d29" transform="rotate(-90 20 220)">y</text><text x="355" y="448" text-anchor="middle" font-size="18" fill="#302d29">x</text></svg>`;
};

export const renderEscapeRoomPage = (user: AuthUser | null): Response => {
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Performance</title>
<style>${cardCss}</style>
</head>
<body>
<main class="page">
<div class="toolbar"><a href="/">PORTAL</a></div>
<section class="cards">
<article class="card" aria-label="컴퓨터 접속 단서 카드">
<div class="ornament"><span class="rule"></span><span class="diamond"></span><span class="rule"></span></div>
<div class="command" aria-label="색상 단서 문장"><span class="word red">Open</span><span class="word blue">our</span><span class="word green">archive</span><span class="word yellow">confirm</span><span class="word purple">performance.</span></div>
<p class="label">컴퓨터 아이디 :</p>
<div class="slots" id="idSlots"><input class="slot red" maxlength="1" aria-label="아이디 빨강" autocomplete="off"><input class="slot blue" maxlength="1" aria-label="아이디 파랑" autocomplete="off"><input class="slot green" maxlength="1" aria-label="아이디 초록" autocomplete="off"><input class="slot yellow" maxlength="1" aria-label="아이디 노랑" autocomplete="off"><input class="slot purple" maxlength="1" aria-label="아이디 보라" autocomplete="off"></div>
<p class="label">컴퓨터 비밀번호 :</p>
<div class="slots password-slots" id="passwordSlots"><input class="slot red" maxlength="1" aria-label="비밀번호 빨강" inputmode="numeric" autocomplete="off"><input class="slot blue" maxlength="1" aria-label="비밀번호 파랑" inputmode="numeric" autocomplete="off"><input class="slot green" maxlength="1" aria-label="비밀번호 초록" inputmode="numeric" autocomplete="off"><input class="slot yellow" maxlength="1" aria-label="비밀번호 노랑" inputmode="numeric" autocomplete="off"><input class="slot wide purple" maxlength="2" aria-label="비밀번호 보라" inputmode="numeric" autocomplete="off"></div>
<div class="action"><button id="enter" class="enter" type="button">ENTER</button></div>
<div id="status" class="status" role="status"></div>
</article>
<article class="card" aria-label="Performance 그래프 카드">
<div class="ornament"><span class="rule"></span></div>
<h1 class="chart-title">Performance</h1>
<div class="chart">${performanceSvg()}</div>
<p class="chart-note">색으로 표시된 점의 x값을 찾아 첫 번째 카드의 색 순서와 연결하세요.</p>
</article>
</section>
</main>
<script>
const idSlots=[...document.querySelectorAll('#idSlots .slot')];
const passwordSlots=[...document.querySelectorAll('#passwordSlots .slot')];
const enter=document.getElementById('enter');
const status=document.getElementById('status');
const allSlots=[...idSlots,...passwordSlots];
allSlots.forEach((slot,index)=>slot.addEventListener('input',()=>{slot.value=slot.value.replace(/[^A-Za-z0-9]/g,'').slice(0,slot.maxLength);const next=allSlots[index+1];if(slot.value&&next)next.focus();}));
async function check(){
 const id=idSlots.map((slot)=>slot.value).join('').trim().toUpperCase();
 const password=passwordSlots.map((slot)=>slot.value).join('').trim();
 if(id.length!==5||password.length!==6){status.className='status failure';status.textContent='입력칸을 모두 채워주세요.';return;}
 enter.disabled=true;status.className='status';status.textContent='확인 중...';
 try{
  const response=await fetch('/api/games/escape-room/answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,password})});
  const body=await response.json().catch(()=>null);
  if(response.ok&&body?.correct){status.className='status success';status.textContent='ACCESS GRANTED';allSlots.forEach((slot)=>slot.disabled=true);enter.textContent='CLEARED';}
  else if(response.status===503){status.className='status failure';status.textContent='게임 서버가 설정되지 않았습니다.';}
  else{status.className='status failure';status.textContent='ACCESS DENIED';passwordSlots.forEach((slot)=>slot.value='');passwordSlots[0].focus();}
 }catch{status.className='status failure';status.textContent='연결 오류가 발생했습니다.';}
 finally{if(!allSlots.some((slot)=>slot.disabled))enter.disabled=false;}
}
enter.addEventListener('click',check);
allSlots.at(-1)?.addEventListener('keydown',(event)=>{if(event.key==='Enter')check();});
</script>
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
