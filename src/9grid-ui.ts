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
  background:#020a12;color:#eaf5ff;
  --bg:#020a12;--panel:#061522;--panel2:#081b2a;--cell:#071b2a;--line:#0c82b6;
  --line-soft:#1c4761;--cyan:#12d9ff;--cyan-soft:#8beaff;--blue:#3d8cff;
  --purple:#9b6cff;--pink:#ff4f76;--green:#27df72;--orange:#ff9b3d;
  --yellow:#ffd45a;--muted:#8fa9bb;--text:#eaf5ff;
}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -10%,#123b56 0,#061522 34%,#020a12 72%);padding:14px}
button{font:inherit}
.app{width:min(1400px,100%);margin:auto}
.top,.panel,.turnbar,.status-group{border:1px solid var(--line-soft);border-radius:12px;background:linear-gradient(180deg,rgba(7,26,42,.98),rgba(3,15,25,.98));box-shadow:0 8px 26px rgba(0,0,0,.28)}
.top{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:13px 15px;margin-bottom:10px;border-color:#0879a9}
.brand{font-size:30px;line-height:1;font-weight:950;letter-spacing:2px}.brand-accent{color:var(--cyan)}
.subtitle{margin-top:6px;color:#b8cde0;font-size:12px;line-height:1.4}.subtitle strong{color:#d7e9ff}.user{color:#b0c8da;font-size:12px;white-space:nowrap}.user a{color:var(--cyan);text-decoration:none;font-weight:900}
.status{display:grid;grid-template-columns:1fr 2.45fr 1.25fr 1.25fr;gap:10px;margin-bottom:10px}.status-group{display:grid;gap:6px;padding:9px}.status-group.player{grid-template-columns:repeat(4,1fr)}.status-group.enemy{grid-template-columns:1fr 1fr}.status-group.run{grid-template-columns:1fr 1.15fr}
.status-group-title{grid-column:1/-1;display:flex;align-items:center;gap:7px;padding:1px 2px;color:var(--cyan);font-size:11px;font-weight:950;letter-spacing:1px}.status-group-title::before{content:"◆";font-size:8px;color:var(--cyan)}
.stat{min-height:63px;padding:8px 9px;border:1px solid #183b51;border-radius:8px;background:rgba(2,14,24,.72)}.label{font-size:10px;font-weight:900;letter-spacing:.9px;color:#9bb2c4}.value{margin-top:4px;font-size:21px;font-weight:950;line-height:1.05}.detail{margin-top:4px;font-size:9px;color:var(--muted);font-weight:800}
.progress-stat .value{font-size:22px}.progress-main{font-size:22px}.progress-sub{margin-top:4px;color:var(--cyan);font-size:11px;font-weight:900}.monster-stat{border-color:#7c2e4b}.monster-stat .value{color:#fff;font-size:20px}.monster-stat .label{color:#ff9bb2}.phase-stat{border-color:#0e789c}.phase-stat .value{color:var(--cyan);font-size:14px;letter-spacing:.5px}
.turnbar{padding:9px 10px;margin-bottom:10px;border-color:#0c82b6}.turnbar-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:7px}.turnbar-title{color:var(--cyan);font-size:12px;font-weight:950;letter-spacing:1.2px}.turnbar-caption{color:#bfeaff;font-size:11px;font-weight:900;text-align:right}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.step{position:relative;padding:10px 7px;text-align:center;border:1px solid #24516d;border-radius:8px;color:#7794a8;font-size:12px;font-weight:950;letter-spacing:.4px;background:#061521}.step.active{border-color:var(--cyan);color:#fff;background:linear-gradient(180deg,#0b88b9,#075071);box-shadow:0 0 0 1px rgba(18,217,255,.2),0 0 20px rgba(18,217,255,.12)}.step.done{border-color:#277e5b;color:#76f3ae;background:#07291e}.step.active::after{content:"";position:absolute;left:50%;bottom:-6px;width:9px;height:9px;background:#0b88b9;border-right:1px solid var(--cyan);border-bottom:1px solid var(--cyan);transform:translateX(-50%) rotate(45deg)}
.layout{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(380px,.82fr) minmax(215px,.42fr);gap:10px;align-items:start}.panel{padding:11px;border-color:#0a6d98}.panel-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:9px}.panel h2{margin:0;color:#dff6ff;font-size:15px;letter-spacing:1.1px}.panel h2 .accent{color:var(--cyan)}
.badge{padding:4px 8px;border:1px solid #17688c;border-radius:999px;font-size:9px;font-weight:900;color:#9bdaf0;white-space:nowrap;background:#061a28}.monster-info{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:9px;padding:8px 10px;border:1px solid #763249;border-radius:8px;background:linear-gradient(90deg,#180a14,#130d18)}.monster-info .label{color:#ff8fa9}.monster-info small{display:block;margin-top:3px;color:#a47f8d;font-size:9px}.monster-info .value{color:#ff5b7e;font-size:22px}
.board-wrap{display:flex;justify-content:center}.board{display:grid;grid-template-columns:repeat(3,minmax(96px,1fr));gap:6px;width:min(100%,535px)}
.slot{position:relative;aspect-ratio:1;min-height:116px;border:1px solid #1c5070;border-radius:9px;background:radial-gradient(circle at 50% 35%,#0a2437,#061421 72%);color:var(--text);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:.15s}.slot:hover:not(:disabled){border-color:var(--cyan);transform:translateY(-1px);box-shadow:0 0 14px rgba(18,217,255,.1)}.slot.empty{border-style:dashed;color:#67879b}.slot .num{position:absolute;top:5px;left:7px;font-size:10px;color:#6c91a7;font-weight:900}.slot-icon{font-size:27px;line-height:1}.slot b{font-size:12px;font-weight:950}.slot span:not(.num){font-size:9px;color:#9bb7c8;font-weight:850}.slot.race-goblin{border-color:#17a84f}.slot.race-elf{border-color:#188ce0}.slot.race-dwarf{border-color:#d7862d}.slot.race-dragon{border-color:#8650dc}
.synergy{margin-top:8px;padding:7px 8px;border:1px solid #173e55;border-radius:8px;background:#04111d}.synergy-group{margin-bottom:6px}.synergy-group:last-child{margin-bottom:0}.synergy-title{margin-bottom:4px;color:#82a6bb;font-size:9px;font-weight:950;letter-spacing:1px}.synergy-line{display:inline-flex;align-items:center;margin:0 4px 3px 0;padding:4px 6px;border:1px solid #28617e;border-radius:999px;background:#071e2d;color:#c7eaff;font-size:9px;font-weight:950}.synergy-line.active-race{color:#65ef9a;border-color:#16854c}.synergy-line.active-job{color:#d6b9ff;border-color:#6c42a5}
.candidate-panel{display:flex;flex-direction:column;gap:8px}.candidate-panel .panel-head{margin-bottom:0}.candidate-instruction{padding:7px 9px;border:1px solid #0c739d;border-radius:7px;background:#062033;color:#aee8ff;font-size:10px;line-height:1.45}.candidate-instruction strong{color:var(--cyan)}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.card{position:relative;min-height:158px;padding:9px;text-align:left;border:1px solid #1e5270;border-radius:9px;background:radial-gradient(circle at 50% 0,#0a2438,#061522 70%);color:#eaf5ff;cursor:pointer}.card:hover:not(:disabled),.card.selected{border-color:var(--cyan);background:linear-gradient(180deg,#092d43,#061824);box-shadow:0 0 0 1px rgba(18,217,255,.22)}.card.selected::after{content:"SELECTED";position:absolute;right:7px;bottom:6px;color:var(--cyan);font-size:7px;font-weight:950;letter-spacing:1px}.card-number{position:absolute;top:6px;right:7px;color:#7595aa;font-size:9px;font-weight:950}.card-icon{height:61px;display:flex;align-items:center;justify-content:center;font-size:42px;line-height:1}.card-name{text-align:center;font-size:14px;font-weight:950;letter-spacing:.5px}.card-job{margin-top:4px;text-align:center;padding:3px 5px;border:1px solid #255a76;border-radius:999px;color:#8fe7ff;font-size:9px;font-weight:950}.card-stats{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:7px}.card-stat{padding:4px;text-align:center;border-radius:5px;background:#06121d;border:1px solid #173b50;font-size:8px;color:#a6bfd0;font-weight:900}.card-stat strong{display:block;margin-top:1px;color:#e9f7ff;font-size:11px}
.actions{display:grid;gap:7px}button{font-weight:950;color:#e8f6ff;background:#071925;border:1px solid #24536d;border-radius:8px;padding:10px 11px;cursor:pointer;font-size:12px;transition:.15s}button:hover:not(:disabled){border-color:var(--cyan);background:#0a2637;transform:translateY(-1px)}button.primary{border-color:#1586ad;color:#bdeeff;background:linear-gradient(180deg,#08324a,#062031)}button.combat{border-color:#a0354f;color:#ff9eb2;background:linear-gradient(180deg,#35101c,#210b13);font-size:13px}button:disabled{opacity:.35;cursor:not-allowed;transform:none}.action-divider{height:1px;background:#16374a;margin:0}.hint{color:#7894a7;font-size:9px;line-height:1.45}
.guide{height:100%;margin:0;padding:0;border:0}.guide-grid{display:flex;flex-direction:column;gap:8px}.guide-group{padding:9px;border:1px solid #16415a;border-radius:8px;background:linear-gradient(180deg,#061a2a,#04111d)}.guide-title{margin-bottom:7px;color:#d9efff;font-size:10px;font-weight:950;letter-spacing:1px}.guide-title::before{content:"◈ ";color:var(--cyan)}.guide-item{display:grid;grid-template-columns:28px 1fr;gap:7px;align-items:center;padding:5px 0;border-top:1px solid rgba(34,78,100,.42);font-size:9px;line-height:1.35}.guide-item:first-of-type{border-top:0}.guide-icon{width:25px;height:25px;display:grid;place-items:center;border:1px solid #2a617d;border-radius:50%;font-size:14px}.guide-name{font-size:9px;font-weight:950}.guide-effect{display:block;margin-top:2px;color:#7897aa}.race-goblin-text{color:#37ed7e}.race-elf-text{color:#5cc7ff}.race-dwarf-text{color:#ffb45d}.race-dragon-text{color:#b994ff}.job-warrior-text{color:#ff6f8c}.job-tank-text{color:#64a5ff}.job-healer-text{color:#49f0df}.job-mage-text{color:#c08bff}
.log-panel{margin-top:10px}.log-panel .panel-head{margin-bottom:7px}.log{height:105px;overflow:auto;border:1px solid #16435c;border-radius:7px;background:#020b12;padding:7px 9px;font-family:ui-monospace,Consolas,monospace;font-size:10px;line-height:1.55}.log div{padding:1px 0;color:#b4c9d8}.danger{color:#ff829d!important}.log::before{content:"LIVE";float:right;color:#6bdcff;border:1px solid #17658a;border-radius:999px;padding:1px 5px;font-size:7px;font-family:Inter,system-ui,sans-serif;font-weight:900}
@media(max-width:1120px){.status{grid-template-columns:1fr 2fr 1.15fr 1.15fr}.layout{grid-template-columns:minmax(0,1.05fr) minmax(340px,.95fr)}.guide{grid-column:1/-1}.guide-grid{display:grid;grid-template-columns:1fr 1fr}.guide-group{min-width:0}.board{width:min(100%,500px)}.slot{min-height:105px}}
@media(max-width:820px){body{padding:8px}.status{grid-template-columns:1fr 1fr}.status-group.player{grid-template-columns:repeat(2,1fr)}.layout{grid-template-columns:1fr}.guide{grid-column:auto}.guide-grid{grid-template-columns:1fr 1fr}.cards{grid-template-columns:repeat(3,1fr)}}
@media(max-width:560px){.top{align-items:flex-start;flex-direction:column;padding:11px}.brand{font-size:23px}.user{font-size:10px}.subtitle{font-size:10px}.status{grid-template-columns:1fr}.turnbar-head{align-items:flex-start;flex-direction:column}.turnbar-caption{text-align:left}.steps{grid-template-columns:repeat(2,1fr)}.panel{padding:9px}.panel-head{align-items:flex-start;flex-direction:column}.board{grid-template-columns:repeat(3,minmax(74px,1fr));gap:4px}.slot{min-height:78px}.slot-icon{font-size:21px}.cards{grid-template-columns:1fr}.card{min-height:118px}.card-icon{height:45px;font-size:34px}.guide-grid{grid-template-columns:1fr}.log{height:130px}}
</style>
</head>
<body>
<main class="app">
  <header class="top">
    <div><div class="brand">9GRID <span class="brand-accent">// SURVIVAL</span></div><div class="subtitle">9턴 안에 몬스터를 처치하세요 · <strong>REROLL → SELECT → PLACE → COMBAT</strong></div></div>
    <div class="user">${userLabel(user)} · <a href="/">HOME</a></div>
  </header>

  <section class="status">
    <div class="status-group progress-stat">
      <div class="status-group-title">RUN PROGRESS</div>
      <div class="stat"><div class="label">ROUND</div><div class="progress-main" id="round">-</div><div class="progress-sub">SURVIVAL</div></div>
      <div class="stat"><div class="label">TURN</div><div class="value" id="turn">-</div><div class="detail">9 TURNS / ROUND</div></div>
    </div>
    <div class="status-group player">
      <div class="status-group-title">PLAYER STATUS</div>
      <div class="stat"><div class="label">♥ HP</div><div class="value" id="hp">-</div></div>
      <div class="stat"><div class="label">⚔ ATK</div><div class="value" id="atk">-</div><div class="detail" id="atk-detail">WARRIOR LV0</div></div>
      <div class="stat"><div class="label">◈ DEF</div><div class="value" id="def">-</div><div class="detail" id="def-detail">TANK LV0</div></div>
      <div class="stat"><div class="label">◆ MANA</div><div class="value" id="mana">-</div><div class="detail" id="mana-detail">MAGE LV0</div></div>
    </div>
    <div class="status-group enemy">
      <div class="status-group-title">ENEMY</div>
      <div class="stat monster-stat"><div class="label">♥ MONSTER HP</div><div class="value" id="monster">-</div></div>
      <div class="stat monster-stat"><div class="label">⚔ MONSTER ATK</div><div class="value" id="monster-attack-top">-</div></div>
    </div>
    <div class="status-group run">
      <div class="status-group-title">RUN STATE</div>
      <div class="stat"><div class="label">SCORE</div><div class="value" id="score">-</div></div>
      <div class="stat phase-stat"><div class="label">CURRENT PHASE</div><div class="value" id="phase">NO SESSION</div></div>
    </div>
  </section>

  <section class="turnbar">
    <div class="turnbar-head"><span class="turnbar-title">◉ TURN FLOW</span><span class="turnbar-caption" id="turn-caption">GAME RESTART를 눌러 시작하세요</span></div>
    <div class="steps"><div class="step" data-phase="reroll">1 · REROLL</div><div class="step" data-phase="select">2 · SELECT</div><div class="step" data-phase="placement">3 · PLACE</div><div class="step" data-phase="combat">4 · COMBAT</div></div>
  </section>

  <div class="layout">
    <section class="panel">
      <div class="panel-head"><h2>🎲 BOARD <span class="accent">// 3 × 3</span></h2><span class="badge">SELECT CARD → PLACE</span></div>
      <div class="monster-info"><div><div class="label">MONSTER ATTACK POWER</div><small>이번 COMBAT에서 플레이어가 받는 기본 피해</small></div><div class="value" id="monster-attack">-</div></div>
      <div class="board-wrap"><div class="board" id="board"></div></div>
      <div class="synergy" id="synergy"></div>
    </section>

    <section class="panel candidate-panel">
      <div class="panel-head"><h2>▣ CANDIDATES <span class="accent">// 3 CARDS</span></h2><span class="badge" id="reroll-count">REROLL 0 / 1</span></div>
      <div class="candidate-instruction"><strong id="candidate-phase">1 · REROLL</strong> · <span id="candidate-help">모든 후보 카드를 먼저 리롤하세요.</span></div>
      <div class="cards" id="cards"></div>
      <div class="actions">
        <button id="reroll" class="primary">🎲 REROLL ALL</button>
        <button id="combat" class="combat">⚔ EXECUTE COMBAT</button>
        <div class="action-divider"></div>
        <button id="start" class="primary">⟳ GAME RESTART</button>
      </div>
      <div class="hint">REROLL은 3장의 카드를 한 번에 교체합니다. 기본 1회이며 고블린 시너지 LV마다 +1회입니다. 전투 후에는 자동 리롤하지 않습니다.</div>
    </section>

    <aside class="guide" aria-label="9Grid synergy guide">
      <div class="guide-grid">
        <div class="guide-group">
          <div class="guide-title">RACE // 종족 효과</div>
          <div class="guide-item"><span class="guide-icon race-goblin-text">👹</span><div><span class="guide-name race-goblin-text">GOBLIN</span><span class="guide-effect">시너지 LV마다 리롤 +1회</span></div></div>
          <div class="guide-item"><span class="guide-icon race-elf-text">🧝</span><div><span class="guide-name race-elf-text">ELF</span><span class="guide-effect">시너지 LV마다 공격 횟수 +1</span></div></div>
          <div class="guide-item"><span class="guide-icon race-dwarf-text">⛏</span><div><span class="guide-name race-dwarf-text">DWARF</span><span class="guide-effect">시너지 LV마다 카드 배치 능력치 +1</span></div></div>
          <div class="guide-item"><span class="guide-icon race-dragon-text">🐉</span><div><span class="guide-name race-dragon-text">DRAGON</span><span class="guide-effect">시너지 LV마다 라운드 점수 +1배</span></div></div>
        </div>
        <div class="guide-group">
          <div class="guide-title">JOB // 직업 효과</div>
          <div class="guide-item"><span class="guide-icon job-warrior-text">⚔</span><div><span class="guide-name job-warrior-text">WARRIOR</span><span class="guide-effect">시너지에 따라 공격 효과 강화</span></div></div>
          <div class="guide-item"><span class="guide-icon job-tank-text">🛡</span><div><span class="guide-name job-tank-text">TANK</span><span class="guide-effect">시너지에 따라 방어 효과 강화</span></div></div>
          <div class="guide-item"><span class="guide-icon job-healer-text">✚</span><div><span class="guide-name job-healer-text">HEALER</span><span class="guide-effect">시너지에 따라 회복량 강화</span></div></div>
          <div class="guide-item"><span class="guide-icon job-mage-text">✦</span><div><span class="guide-name job-mage-text">MAGE</span><span class="guide-effect">시너지에 따라 마법 공격력 강화</span></div></div>
        </div>
      </div>
    </aside>
  </div>

  <section class="panel log-panel">
    <div class="panel-head"><h2>⚔ COMBAT LOG</h2><span class="badge">LIVE</span></div>
    <div class="log" id="log"></div>
  </section>
</main>

<script>
let state=null;
let selectedCardId=null;
let monsterAttack=null;
const $=(id)=>document.getElementById(id);
const raceIcons={goblin:"👹",elf:"🧝",dwarf:"⛏",dragon:"🐉"};
const jobIcons={warrior:"⚔",tank:"🛡",healer:"✚",mage:"✦"};
const placementStats={
  warrior:[["⚔ ATK",2],["◈ DEF",0]],
  tank:[["⚔ ATK",0],["◈ DEF",2]],
  healer:[["♥ HP",6],["◈ DEF",0]],
  mage:[["◆ MANA",1],["⚔ ATK",0]],
};
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
  const race=Object.entries(s.races).map(([name,level])=>'<span class="synergy-line active-race">'+raceIcons[name]+" "+name.toUpperCase()+" LV"+level+"</span>").join("");
  const jobs=Object.entries(s.jobs).map(([name,level])=>'<span class="synergy-line active-job">'+jobIcons[name]+" "+name.toUpperCase()+" LV"+level+"</span>").join("");
  $("synergy").innerHTML='<div class="synergy-group"><div class="synergy-title">RACE SYNERGY</div>'+(race||'<span class="hint">아직 완성된 종족 시너지가 없습니다.</span>')+'</div><div class="synergy-group"><div class="synergy-title">JOB SYNERGY</div>'+(jobs||'<span class="hint">아직 완성된 직업 시너지가 없습니다.</span>')+'</div>';
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
    button.className="slot"+(card?" race-"+card.race:" empty");
    button.dataset.index=String(index);
    const num=document.createElement("span");
    num.className="num";
    num.textContent=String(index+1);
    if(card){
      const icon=document.createElement("span");icon.className="slot-icon";icon.textContent=raceIcons[card.race];
      const race=document.createElement("b");race.textContent=card.race.toUpperCase();
      const job=document.createElement("span");job.textContent=jobIcons[card.job]+" "+card.job.toUpperCase();
      button.append(num,icon,race,job);
    }else{
      const empty=document.createElement("b");empty.textContent="+";
      const hint=document.createElement("span");hint.textContent="비어있음";
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
    const icon=document.createElement("div");icon.className="card-icon";icon.textContent=raceIcons[card.race];
    const name=document.createElement("div");name.className="card-name";name.textContent=card.race.toUpperCase();
    const job=document.createElement("div");job.className="card-job";job.textContent=jobIcons[card.job]+" "+card.job.toUpperCase();
    const stats=document.createElement("div");stats.className="card-stats";
    const values=placementStats[card.job]||[["⚔ ATK",0],["◈ DEF",0]];
    const first=document.createElement("div");first.className="card-stat";first.textContent=values[0][0];const firstValue=document.createElement("strong");firstValue.textContent="+"+values[0][1];first.appendChild(firstValue);
    const second=document.createElement("div");second.className="card-stat";second.textContent=values[1][0];const secondValue=document.createElement("strong");secondValue.textContent="+"+values[1][1];second.appendChild(secondValue);
    stats.append(first,second);
    button.append(number,icon,name,job,stats);
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
