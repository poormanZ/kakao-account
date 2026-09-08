import type { AuthUser } from "./auth";

const esc = (value: string): string => value.replace(/[&<>]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
}[char] ?? char));

const userLabel = (user: AuthUser | null): string => (
  user?.nickname ? esc(user.nickname) : user ? `USER #${user.id}` : "GUEST"
);

export const render9GridPage = (user: AuthUser | null): Response => {
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>9Grid — 9 Grid Survival</title>
<style>
:root{
  color-scheme:dark;
  font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  background:#070a0d;color:#e8eef2;--surface:#0d1217;--surface-strong:#101820;--surface-soft:#0a1015;
  --line:#2b3943;--line-strong:#3a4b56;--muted:#93a2ab;--cyan:#63d7ff;--green:#65e6a5;--red:#ff7373;
}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,#14212a,#070a0d 46%);padding:18px}
button{font:inherit}
.app{width:min(1440px,100%);margin:auto}
.top,.panel,.turnbar{border:1px solid var(--line);border-radius:12px;background:rgba(13,18,23,.98);box-shadow:0 10px 28px rgba(0,0,0,.16)}
.top{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:20px 22px;margin-bottom:14px}
.brand{font-size:25px;font-weight:950;letter-spacing:2px}
.subtitle{margin-top:7px;color:var(--muted);font-size:13px;line-height:1.5}
.user{color:var(--muted);font-size:13px;white-space:nowrap}.user a{color:var(--cyan);text-decoration:none;font-weight:800}
.status{display:grid;grid-template-columns:1fr 2fr 1.15fr 1.15fr;gap:10px;margin-bottom:14px}
.status-group{display:grid;gap:8px;padding:10px;border:1px solid var(--line);border-radius:10px;background:rgba(13,18,23,.98)}
.status-group.player{grid-template-columns:repeat(4,1fr)}.status-group.enemy{grid-template-columns:1fr 1fr}.status-group.run{grid-template-columns:1fr 1.2fr}
.status-group-title{grid-column:1/-1;padding:1px 2px 0;color:var(--muted);font-size:10px;font-weight:900;letter-spacing:1.4px}
.stat{min-height:76px;padding:11px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.label{font-size:11px;font-weight:900;letter-spacing:1px;color:var(--muted)}
.value{margin-top:6px;font-size:23px;font-weight:950;line-height:1.05}.detail{margin-top:5px;font-size:11px;color:var(--muted)}
.monster-stat{border-color:#703b43}.monster-stat .value{color:var(--red)}.phase-stat{border-color:#315c69}.phase-stat .value{color:var(--cyan);font-size:16px}
.turnbar{padding:15px 16px;margin-bottom:14px}.turnbar-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:10px}
.turnbar-title{font-size:13px;font-weight:950;letter-spacing:1.5px}.turnbar-caption{color:var(--cyan);font-size:13px;font-weight:800;text-align:right}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.step{padding:11px 8px;text-align:center;border:1px solid #30414a;border-radius:7px;color:#71828b;font-size:12px;font-weight:900;letter-spacing:.5px}
.step.active{border-color:var(--cyan);color:var(--cyan);background:#10232c;box-shadow:0 0 0 1px rgba(99,215,255,.14)}.step.done{border-color:#426b59;color:var(--green);background:#0d1b15}
.layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(360px,.85fr);gap:14px;align-items:start}.panel{padding:18px}
.panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:13px}.panel h2{margin:0;font-size:16px;letter-spacing:1.3px}
.badge{padding:5px 9px;border:1px solid var(--line);border-radius:999px;font-size:10px;font-weight:800;color:var(--muted);white-space:nowrap}
.monster-info{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px;padding:12px 14px;border:1px solid #63383e;border-radius:9px;background:#130e11}
.monster-info small{display:block;margin-top:4px;color:#b18080;font-size:11px}.monster-info .value{color:var(--red);font-size:27px}
.board-wrap{display:flex;justify-content:center}.board{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:9px;width:min(100%,600px)}
.slot{position:relative;aspect-ratio:1;min-height:135px;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface-strong);color:#e8eef2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer}
.slot:hover:not(:disabled){border-color:var(--cyan);background:#12212a}.slot.empty{border-style:dashed;color:#62737c}.slot b{font-size:17px;font-weight:950}.slot span{font-size:12px;color:var(--muted);font-weight:800}.slot .num{position:absolute;top:8px;left:9px;font-size:10px;color:#667984}.slot:disabled{cursor:default}
.synergy{border-top:1px solid var(--line);margin-top:16px;padding-top:13px}.synergy-group{margin-bottom:10px}.synergy-group:last-child{margin-bottom:0}
.synergy-title{margin-bottom:6px;color:var(--muted);font-size:11px;font-weight:900;letter-spacing:1px}.synergy-line{display:inline-block;margin:0 6px 5px 0;padding:6px 9px;border:1px solid #385467;border-radius:6px;background:#101d25;color:#a9ddf0;font-size:11px;font-weight:900}
.guide{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}.guide-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.guide-group{padding:11px 12px;border:1px solid #263640;border-radius:8px;background:var(--surface-soft)}.guide-title{margin-bottom:8px;font-size:11px;font-weight:950;letter-spacing:1px;color:var(--cyan)}
.guide-item{display:flex;gap:10px;padding:4px 0;font-size:11px;line-height:1.45}.guide-name{min-width:60px;font-weight:950}.guide-effect{color:var(--muted)}
.candidate-panel{display:flex;flex-direction:column;gap:13px}.candidate-panel .panel-head{margin-bottom:0}
.candidate-instruction{padding:11px 12px;border:1px solid #315c69;border-radius:8px;background:#0d1b22;color:#bdeeff;font-size:12px;line-height:1.5}.candidate-instruction strong{color:var(--cyan)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.card{min-height:145px;padding:14px;text-align:left;border:1px solid var(--line-strong);border-radius:9px;background:var(--surface-strong);color:#e8eef2;cursor:pointer}
.card:hover:not(:disabled),.card.selected{border-color:var(--cyan);background:#12212a}.card.selected{box-shadow:0 0 0 1px var(--cyan)}.card-name{margin-top:18px;font-size:17px;font-weight:950}.card-job{margin-top:7px;color:var(--muted);font-size:12px;font-weight:800}.card-number{float:right;color:#71848e;font-size:10px;font-weight:900}
.actions{display:grid;gap:9px}button{font-weight:950;color:#e8eef2;background:#131c22;border:1px solid var(--line-strong);border-radius:8px;padding:14px 14px;cursor:pointer;font-size:14px}
button:hover:not(:disabled){border-color:var(--cyan);background:#15252e}button.primary{border-color:#39708a;color:#bdeeff}button.combat{border-color:#75454b;color:#ffb1b1;background:#1a1114}button:disabled{opacity:.35;cursor:not-allowed}
.action-divider{height:1px;background:var(--line);margin:1px 0}.hint{color:var(--muted);font-size:11px;line-height:1.6}
.log-panel{margin-top:14px}.log{height:210px;overflow:auto;border:1px solid var(--line);border-radius:8px;background:#080d11;padding:12px;font-family:ui-monospace,Consolas,monospace;font-size:13px;line-height:1.75}.log div{padding:2px 0}.danger{color:#ff8888}
@media(max-width:1180px){.status{grid-template-columns:1fr 1.8fr 1fr 1fr}.status-group.player{grid-template-columns:repeat(2,1fr)}.status-group.player .status-group-title{grid-column:1/-1}.board{width:min(100%,540px)}.slot{min-height:120px}}
@media(max-width:900px){body{padding:10px}.status{grid-template-columns:repeat(2,1fr)}.layout{grid-template-columns:1fr}.candidate-panel{min-width:0}}
@media(max-width:620px){.top{align-items:flex-start;flex-direction:column;padding:16px}.brand{font-size:21px}.subtitle,.user{font-size:12px}.status{grid-template-columns:1fr}.status-group.player{grid-template-columns:repeat(2,1fr)}.status-group.enemy,.status-group.run{grid-template-columns:1fr 1fr}.turnbar-head{align-items:flex-start;flex-direction:column}.turnbar-caption{text-align:left}.steps{grid-template-columns:repeat(2,1fr)}.panel{padding:14px}.panel-head{align-items:flex-start;flex-direction:column}.board{grid-template-columns:repeat(3,minmax(82px,1fr));gap:6px}.slot{min-height:82px}.slot b{font-size:14px}.slot span{font-size:10px}.cards{grid-template-columns:1fr}.card{min-height:105px}.guide-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<main class="app">
  <header class="top">
    <div><div class="brand">9GRID <span style="color:var(--cyan)">//</span> SURVIVAL</div><div class="subtitle">9턴 안에 몬스터를 처치하세요 · <strong>REROLL → SELECT → PLACE → COMBAT</strong></div></div>
    <div class="user">${userLabel(user)} · <a href="/">HOME</a></div>
  </header>

  <section class="status">
    <div class="status-group">
      <div class="status-group-title">RUN PROGRESS</div>
      <div class="stat"><div class="label">ROUND</div><div class="value" id="round">-</div></div>
      <div class="stat"><div class="label">TURN</div><div class="value" id="turn">-</div></div>
    </div>
    <div class="status-group player">
      <div class="status-group-title">PLAYER STATUS</div>
      <div class="stat"><div class="label">HP</div><div class="value" id="hp">-</div></div>
      <div class="stat"><div class="label">ATK</div><div class="value" id="atk">-</div><div class="detail" id="atk-detail">WARRIOR LV0</div></div>
      <div class="stat"><div class="label">DEF</div><div class="value" id="def">-</div><div class="detail" id="def-detail">TANK LV0</div></div>
      <div class="stat"><div class="label">MANA</div><div class="value" id="mana">-</div><div class="detail" id="mana-detail">MAGE LV0</div></div>
    </div>
    <div class="status-group enemy">
      <div class="status-group-title">ENEMY</div>
      <div class="stat monster-stat"><div class="label">MONSTER HP</div><div class="value" id="monster">-</div></div>
      <div class="stat monster-stat"><div class="label">MONSTER ATK</div><div class="value" id="monster-attack-top">-</div></div>
    </div>
    <div class="status-group run">
      <div class="status-group-title">RUN STATE</div>
      <div class="stat"><div class="label">SCORE</div><div class="value" id="score">-</div></div>
      <div class="stat phase-stat"><div class="label">CURRENT PHASE</div><div class="value" id="phase">NO SESSION</div></div>
    </div>
  </section>

  <section class="turnbar">
    <div class="turnbar-head"><span class="turnbar-title">TURN FLOW</span><span class="turnbar-caption" id="turn-caption">GAME RESTART를 눌러 시작하세요</span></div>
    <div class="steps"><div class="step" data-phase="reroll">1 · REROLL</div><div class="step" data-phase="select">2 · SELECT</div><div class="step" data-phase="placement">3 · PLACE</div><div class="step" data-phase="combat">4 · COMBAT</div></div>
  </section>

  <div class="layout">
    <section class="panel">
      <div class="panel-head"><h2>BOARD // 3 × 3</h2><span class="badge">SELECT CARD → PLACE ON BOARD</span></div>
      <div class="monster-info"><div><div class="label">MONSTER ATTACK POWER</div><small>이번 COMBAT에서 플레이어가 받는 기본 피해</small></div><div class="value" id="monster-attack">-</div></div>
      <div class="board-wrap"><div class="board" id="board"></div></div>
      <div class="synergy" id="synergy"></div>
      <div class="guide">
        <div class="guide-grid">
          <div class="guide-group">
            <div class="guide-title">RACE // 종족 효과</div>
            <div class="guide-item"><span class="guide-name">GOBLIN</span><span class="guide-effect">시너지 LV마다 리롤 +1회</span></div>
            <div class="guide-item"><span class="guide-name">ELF</span><span class="guide-effect">시너지 LV마다 공격 횟수 +1</span></div>
            <div class="guide-item"><span class="guide-name">DWARF</span><span class="guide-effect">시너지 LV마다 카드 배치 능력치 +1</span></div>
            <div class="guide-item"><span class="guide-name">DRAGON</span><span class="guide-effect">시너지 LV마다 라운드 점수 +1배</span></div>
          </div>
          <div class="guide-group">
            <div class="guide-title">JOB // 직업 효과</div>
            <div class="guide-item"><span class="guide-name">WARRIOR</span><span class="guide-effect">시너지에 따라 공격 효과 강화</span></div>
            <div class="guide-item"><span class="guide-name">TANK</span><span class="guide-effect">시너지에 따라 방어 효과 강화</span></div>
            <div class="guide-item"><span class="guide-name">HEALER</span><span class="guide-effect">시너지에 따라 회복량 강화</span></div>
            <div class="guide-item"><span class="guide-name">MAGE</span><span class="guide-effect">시너지에 따라 마법 공격력 강화</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel candidate-panel">
      <div class="panel-head"><h2>CANDIDATES // 3 CARDS</h2><span class="badge" id="reroll-count">REROLL 0 / 1</span></div>
      <div class="candidate-instruction"><strong id="candidate-phase">1 · REROLL</strong> · <span id="candidate-help">모든 후보 카드를 먼저 리롤하세요.</span></div>
      <div class="cards" id="cards"></div>
      <div class="actions">
        <button id="reroll" class="primary">↻ REROLL ALL</button>
        <button id="combat" class="combat">⚔ EXECUTE COMBAT</button>
        <div class="action-divider"></div>
        <button id="start" class="primary">↻ GAME RESTART</button>
      </div>
      <div class="hint">REROLL은 3장의 카드를 한 번에 교체합니다. 기본 1회이며 고블린 시너지 LV마다 +1회입니다. 전투 후에는 자동 리롤하지 않습니다.</div>
    </section>
  </div>

  <section class="panel log-panel">
    <div class="panel-head"><h2>COMBAT LOG</h2><span class="badge">LIVE</span></div>
    <div class="log" id="log"></div>
  </section>
</main>

<script>
let state=null;
let selectedCardId=null;
let monsterAttack=null;
const $=(id)=>document.getElementById(id);
function log(text,cls=""){
  const p=document.createElement("div");
  p.className=cls;
  p.textContent="> "+text;
  $("log").appendChild(p);
  $("log").scrollTop=$("log").scrollHeight;
}
async function request(path,options={}){
  const response=await fetch(path,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  let body=null;
  try{body=await response.json()}catch{}
  if(!response.ok)throw new Error(body?.error||"Request failed");
  if(Number.isFinite(body?.monsterAttack))monsterAttack=body.monsterAttack;
  return body;
}
function calculateSynergy(board){
  const races={};
  const jobs={};
  const add=(cards)=>{
    if(cards.length!==3||cards.some((card)=>!card))return;
    const race=cards.every((card)=>card.race===cards[0].race)?cards[0].race:null;
    const job=cards.every((card)=>card.job===cards[0].job)?cards[0].job:null;
    if(race)races[race]=Math.min(5,(races[race]||0)+1);
    if(job)jobs[job]=Math.min(5,(jobs[job]||0)+1);
  };
  for(let i=0;i<3;i+=1){add(board.slice(i*3,i*3+3));add([board[i],board[i+3],board[i+6]])}
  return {races,jobs};
}
function updateFlow(phase){
  const order=["reroll","select","placement","combat"];
  document.querySelectorAll(".step").forEach((step)=>{
    const p=step.dataset.phase;
    step.classList.toggle("active",p===phase);
    step.classList.toggle("done",order.indexOf(p)>=0&&order.indexOf(p)<order.indexOf(phase));
  });
  const captions={reroll:"모든 후보 카드를 REROLL하세요",select:"사용할 카드 1장을 선택하세요",placement:"선택한 카드를 보드에 배치하세요",combat:"EXECUTE COMBAT으로 전투를 실행하세요",game_over:"RUN 종료 · GAME RESTART로 1라운드부터 시작하세요"};
  const phaseLabels={reroll:"1 · REROLL",select:"2 · SELECT",placement:"3 · PLACE",combat:"4 · COMBAT",game_over:"RUN OVER"};
  $("turn-caption").textContent=captions[phase]||"게임을 시작하세요";
  $("candidate-phase").textContent=phaseLabels[phase]||"READY";
  $("candidate-help").textContent=captions[phase]||"게임을 시작하세요";
}
function renderSynergy(s){
  const race=Object.entries(s.races).map(([name,level])=>'<span class="synergy-line">'+name.toUpperCase()+" LV"+level+"</span>").join("");
  const jobs=Object.entries(s.jobs).map(([name,level])=>'<span class="synergy-line">'+name.toUpperCase()+" LV"+level+"</span>").join("");
  $("synergy").innerHTML='<div class="synergy-group"><div class="synergy-title">RACE SYNERGY</div>'+(race||'<span class="hint">없음</span>')+'</div><div class="synergy-group"><div class="synergy-title">JOB SYNERGY</div>'+(jobs||'<span class="hint">없음</span>')+'</div>';
}
function render(){
  if(!state){$("phase").textContent="NO SESSION";updateFlow("game_over");return;}
  const r=state.round;
  const s=calculateSynergy(state.board);
  $("round").textContent=r.round;
  $("turn").textContent=r.turn+" / 9";
  $("hp").textContent=r.playerHp+" / "+r.playerMaxHp;
  $("atk").textContent=state.playerStats.attack;
  $("def").textContent=state.playerStats.defense;
  $("mana").textContent=state.playerStats.mana;
  $("atk-detail").textContent="WARRIOR LV"+(s.jobs.warrior||0);
  $("def-detail").textContent="TANK LV"+(s.jobs.tank||0);
  $("mana-detail").textContent="MAGE LV"+(s.jobs.mage||0);
  $("score").textContent=r.round*(s.races.dragon||0);
  $("monster").textContent=r.monsterHp+" / "+r.monsterMaxHp;
  $("phase").textContent=r.phase.toUpperCase();
  $("monster-attack").textContent=monsterAttack??"-";
  $("monster-attack-top").textContent=monsterAttack??"-";
  updateFlow(r.phase);
  renderSynergy(s);
  renderBoard();
  renderCards();
  const goblinLevel=s.races.goblin||0;
  $("reroll-count").textContent="REROLL "+r.candidates.rerollsUsed+" / "+(1+goblinLevel);
  $("reroll").disabled=(r.phase!=="reroll"&&r.phase!=="select")||r.candidates.rerollsUsed>=1+goblinLevel;
  $("combat").disabled=r.phase!=="combat";
  $("start").disabled=false;
}
function renderBoard(){
  const board=$("board");
  board.innerHTML="";
  state.board.forEach((card,index)=>{
    const button=document.createElement("button");
    button.className="slot"+(card?"":" empty");
    button.dataset.index=String(index);
    if(card){
      const num=document.createElement("span");num.className="num";num.textContent=String(index+1);
      const race=document.createElement("b");race.textContent=card.race.toUpperCase();
      const job=document.createElement("span");job.textContent=card.job.toUpperCase();
      button.append(num,race,job);
    }else{
      const num=document.createElement("span");num.className="num";num.textContent=String(index+1);
      const empty=document.createElement("b");empty.textContent="EMPTY";
      const hint=document.createElement("span");hint.textContent="PLACE HERE";
      button.append(num,empty,hint);
    }
    button.disabled=!selectedCardId||state.round.phase!=="placement";
    button.addEventListener("click",()=>place(index));
    board.appendChild(button);
  });
}
function renderCards(){
  const cards=$("cards");
  cards.innerHTML="";
  state.round.candidates.cards.forEach((card,index)=>{
    const button=document.createElement("button");
    button.className="card"+(card.id===selectedCardId?" selected":"");
    const number=document.createElement("span");number.className="card-number";number.textContent="#"+(index+1);
    const name=document.createElement("div");name.className="card-name";name.textContent=card.race.toUpperCase();
    const job=document.createElement("div");job.className="card-job";job.textContent=card.job.toUpperCase();
    button.append(number,name,job);
    button.disabled=state.round.phase!=="select";
    button.addEventListener("click",()=>selectCard(card.id));
    cards.appendChild(button);
  });
}
async function send(action,message){
  try{
    const body=await request("/api/games/9grid/session/action",{method:"POST",body:JSON.stringify(action)});
    state=body.state;
    selectedCardId=null;
    render();
    if(message)log(message);
  }catch(error){log(error instanceof Error?error.message:"Request failed","danger")}
}
async function restart(){await send({type:"start"},"GAME RESTART · ROUND 1 / TURN 1")}
async function reroll(){await send({type:"reroll"},"REROLL ALL · 모든 후보 카드 교체")}
async function selectCard(cardId){
  try{
    const body=await request("/api/games/9grid/session/action",{method:"POST",body:JSON.stringify({type:"select",cardId})});
    state=body.state;
    selectedCardId=cardId;
    render();
    log("CARD SELECTED · 보드에 배치하세요");
  }catch(error){log(error instanceof Error?error.message:"Request failed","danger")}
}
async function place(boardIndex){if(!selectedCardId)return;await send({type:"place",boardIndex},"CARD PLACED · COMBAT READY")}
async function combat(){await send({type:"combat"},"COMBAT COMPLETE · 다음 턴에 REROLL ALL을 눌러주세요")}
$("start").addEventListener("click",restart);
$("reroll").addEventListener("click",reroll);
$("combat").addEventListener("click",combat);
async function load(){
  try{
    const body=await request("/api/games/9grid/session");
    state=body.state;
    render();
    if(state)log("SESSION LOADED · ROUND "+state.round.round+" / TURN "+state.round.turn);
  }catch(error){log(error instanceof Error?error.message:"Session load failed","danger")}
}
load();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
