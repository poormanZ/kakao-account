import type { AuthUser } from "./auth";

const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;",
}[char] ?? char));

const userLabel = (user: AuthUser | null): string => (
  user?.nickname ? esc(user.nickname) : user ? `USER #${user.id}` : "GUEST"
);

export const renderEscapeRoomPage = (user: AuthUser | null): Response => {
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Escape Room // PRIME</title>
<style>
:root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#07090a;color:#dce5e8}
*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:10px;background:radial-gradient(circle at top,#18252b 0,#080b0d 55%,#050607 100%)}
.app{max-width:1080px;margin:auto;border:1px solid #40515a;background:#0a0f12;box-shadow:0 18px 55px #000;padding:14px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;border-bottom:1px solid #314047;padding:8px 4px 14px}.brand{font-weight:900;letter-spacing:2px}.muted{color:#7f9098;font-size:12px}.user{display:flex;gap:8px;align-items:center}a,button,input{font:inherit;color:inherit;background:#10171a;border:1px solid #50626a;padding:9px 11px;text-decoration:none}button{cursor:pointer}button:hover,a:hover{background:#182329}.hero{padding:28px 4px 20px}.hero h1{font-size:clamp(30px,7vw,58px);letter-spacing:5px;margin:0 0 7px}.hero p{margin:0;color:#8b9aa1}.terminal{border:1px solid #35464d;background:#080c0e;padding:16px}.line{margin:0 0 9px;line-height:1.7}.prompt{color:#87a9b5}.clue{font-size:clamp(18px,3vw,28px);font-weight:800;letter-spacing:.5px;line-height:1.8;padding:15px 0}.word{display:inline-block;margin-right:9px}.red{color:#ff6b6b}.blue{color:#69a7ff}.green{color:#75d58a}.yellow{color:#f1d56a}.purple{color:#bd8cff}.controls{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:15px 0}.setting{border-color:#71838b;font-weight:800}.graph-panel{display:none;border:1px solid #33444b;background:#0b1114;padding:14px;margin-top:12px}.graph-panel.open{display:block}.graph{height:230px;position:relative;border-left:1px solid #52636a;border-bottom:1px solid #52636a;margin:15px 10px 8px;background:repeating-linear-gradient(to top,transparent 0,transparent 44px,#18272d 45px)}.axis{position:absolute;color:#667a82;font-size:10px}.axis.y1{left:-26px;bottom:12px}.axis.y2{left:-26px;bottom:55px}.axis.y3{left:-26px;bottom:99px}.axis.y4{left:-26px;bottom:143px}.axis.y5{left:-26px;bottom:187px}.point{position:absolute;width:13px;height:13px;border-radius:50%;transform:translate(-50%,50%);box-shadow:0 0 12px currentColor}.point.red{left:10%;bottom:25%}.point.blue{left:30%;bottom:36%}.point.green{left:50%;bottom:52%}.point.yellow{left:70%;bottom:68%}.point.purple{left:90%;bottom:86%}.legend{display:flex;gap:15px;flex-wrap:wrap;color:#8d9ca3;font-size:11px}.legend span::before{content:"●";margin-right:5px}.legend .red::before{color:#ff6b6b}.legend .blue::before{color:#69a7ff}.legend .green::before{color:#75d58a}.legend .yellow::before{color:#f1d56a}.legend .purple::before{color:#bd8cff}.solve{margin-top:15px;border-top:1px dashed #26363c;padding-top:15px}.solve-row{display:flex;gap:8px;max-width:620px}.solve input{flex:1;min-width:0;text-transform:uppercase}.status{min-height:24px;margin-top:10px;font-size:12px}.success{color:#8fe0a1}.failure{color:#e08e8e}.hint{margin-top:16px;border:1px solid #26363c;padding:11px;color:#83949b;font-size:12px}.hint button{margin-left:8px;padding:5px 8px}.footer{margin-top:14px;padding-top:12px;border-top:1px solid #253239;color:#61717a;font-size:11px;display:flex;justify-content:space-between;gap:8px}@media(max-width:620px){body{padding:5px}.app{padding:10px}.top{align-items:flex-start;flex-direction:column}.user{width:100%;justify-content:space-between}.solve-row{flex-direction:column}.solve input{width:100%}.clue{line-height:2.1}}
</style>
</head>
<body>
<main class="app">
<header class="top"><div><div class="brand">ESCAPE ROOM // PRIME</div><div class="muted">terminal://games/escape-room</div></div><div class="user"><span class="muted">${userLabel(user)}</span><a href="/">PORTAL</a></div></header>
<section class="hero"><h1>ESCAPE ROOM</h1><p>Observe. Connect. Decode. The room does not tell you what to enter.</p></section>
<section class="terminal">
<p class="line prompt">&gt; SYSTEM MESSAGE</p>
<p class="line">Open our archive, confirm performance.</p>
<div class="clue" aria-label="색상이 적용된 단서 문장"><span class="word red">Open</span><span class="word blue">our</span><span class="word green">archive</span><span class="word yellow">confirm</span><span class="word purple">performance.</span></div>
<div class="controls"><span class="muted">&gt; one interface may contain more than it shows</span><button id="setting" class="setting" type="button">SETTING</button></div>
<div id="graphPanel" class="graph-panel" aria-hidden="true">
<strong>MODEL PERFORMANCE</strong>
<div class="graph" aria-label="모델 성능 그래프"><span class="axis y1">0</span><span class="axis y2">3</span><span class="axis y3">5</span><span class="axis y4">7</span><span class="axis y5">11</span><i class="point red" title="2"></i><i class="point blue" title="3"></i><i class="point green" title="5"></i><i class="point yellow" title="7"></i><i class="point purple" title="11"></i></div>
<div class="legend"><span class="red">RED</span><span class="blue">BLUE</span><span class="green">GREEN</span><span class="yellow">YELLOW</span><span class="purple">PURPLE</span></div>
<p class="muted">Five highlighted values. Match them to the colors in the message.</p>
</div>
<div class="solve">
<div class="muted">&gt; ENTER ACCESS KEY</div>
<div class="solve-row"><input id="answer" maxlength="32" autocomplete="off" spellcheck="false" placeholder="TYPE KEY"><button id="submit" type="button">ENTER KEY</button></div>
<div id="status" class="status" role="status"></div>
</div>
<div class="hint"><span id="hintText">HINT 01: Some colors appear twice.</span><button id="hint" type="button">NEXT HINT</button></div>
</section>
<footer class="footer"><span>SERVER AUTHORITATIVE · ANSWER NOT STORED IN CLIENT</span><span>ACCOUNT: ${user ? "AUTHENTICATED" : "GUEST"}</span></footer>
</main>
<script>
const setting=document.getElementById('setting');
const graphPanel=document.getElementById('graphPanel');
const answer=document.getElementById('answer');
const submit=document.getElementById('submit');
const status=document.getElementById('status');
const hintButton=document.getElementById('hint');
const hintText=document.getElementById('hintText');
const hints=['HINT 01: Some colors appear twice.','HINT 02: Follow the colors.','HINT 03: Numbers can point to letters.','HINT 04: Count from the beginning.'];
let hintIndex=0;
setting.addEventListener('click',()=>{const open=graphPanel.classList.toggle('open');graphPanel.setAttribute('aria-hidden',String(!open));setting.textContent=open?'CLOSE SETTING':'SETTING';});
hintButton.addEventListener('click',()=>{hintIndex=Math.min(hintIndex+1,hints.length-1);hintText.textContent=hints[hintIndex];hintButton.disabled=hintIndex===hints.length-1;});
async function check(){const value=answer.value.trim();if(!value){status.className='status failure';status.textContent='> ENTER A KEY';return;}submit.disabled=true;status.className='status';status.textContent='> VERIFYING...';try{const response=await fetch('/api/games/escape-room/answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answer:value})});const body=await response.json().catch(()=>null);if(response.ok&&body?.correct){status.className='status success';status.textContent='> ACCESS GRANTED · STEP 1 CLEARED';submit.textContent='CLEARED';answer.disabled=true;hintButton.disabled=true;}else if(response.status===503){status.className='status failure';status.textContent='> GAME SERVER NOT CONFIGURED';}else{status.className='status failure';status.textContent='> ACCESS DENIED · TRY AGAIN';answer.select();}}catch{status.className='status failure';status.textContent='> CONNECTION ERROR';}finally{if(!answer.disabled)submit.disabled=false;}}
submit.addEventListener('click',check);answer.addEventListener('keydown',(event)=>{if(event.key==='Enter')check();});
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
