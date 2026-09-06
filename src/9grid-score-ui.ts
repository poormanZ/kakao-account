import type { AuthUser } from "./auth";
import { render9GridPage } from "./9grid-ui";

const scorePanel = `<section class="panel" style="margin-top:18px"><h2>SCORE // RANKING</h2><div id="scoreStatus" class="hint">기록을 불러오는 중...</div><div id="scoreBest" class="hint"></div><div id="scoreRanking" class="hint"></div></section>`;

const scoreScript = (authenticated: boolean): string => `<script>
const SCORE_AUTH=${authenticated ? "true" : "false"};
let scoreSaved=false;
let lastClearTurn=0;
const scoreEl=(id)=>document.getElementById(id);
const escapeScoreText=(value)=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
async function scoreJson(url,options){const response=await fetch(url,options);const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||'request failed');return body;}
async function loadScores(){if(!SCORE_AUTH){scoreEl('scoreStatus').textContent='로그인 후 개인 기록과 랭킹을 확인할 수 있습니다.';return;}try{const results=await Promise.all([scoreJson('/api/games/9grid/best'),scoreJson('/api/games/9grid/my-rank'),scoreJson('/api/games/9grid/ranking?limit=10')]);const best=results[0];const rank=results[1];const ranking=results[2];scoreEl('scoreStatus').textContent=rank.rank?'MY RANK: #'+rank.rank:'아직 저장된 플레이 기록이 없습니다.';scoreEl('scoreBest').textContent=best.score?'BEST: ROUND '+best.score.max_round+' · CLEAR TURN '+best.score.last_round_clear_turn+' · HP '+best.score.remaining_hp:'BEST: -';const rows=(ranking.scores||[]).map((row,i)=>(i+1)+'. '+escapeScoreText(row.nickname||('USER #'+row.account_user_id))+' · R'+row.max_round+' · T'+row.last_round_clear_turn+' · HP '+row.remaining_hp);scoreEl('scoreRanking').innerHTML=rows.length?'<div>TOP 10</div>'+rows.map((row)=>'<div>'+row+'</div>').join(''):'TOP 10: -';}catch(error){scoreEl('scoreStatus').textContent='랭킹 정보를 불러오지 못했습니다.';}}
async function saveScore(){if(!SCORE_AUTH||scoreSaved)return;const round=Number(scoreEl('round')?.textContent||'1');const hp=Number.parseInt((scoreEl('php')?.textContent||'0').split('/')[0],10);const maxRound=Math.max(0,round-1);try{await scoreJson('/api/games/9grid/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({max_round:maxRound,last_round_clear_turn:lastClearTurn,remaining_hp:Math.max(0,hp)})});scoreSaved=true;await loadScores();}catch(error){const log=scoreEl('log');if(log){const line=document.createElement('div');line.className='danger';line.textContent='> SCORE SAVE FAILED';log.appendChild(line);log.scrollTop=log.scrollHeight;}}}
const observer=new MutationObserver(()=>{const round=Number(scoreEl('round')?.textContent||'1');const turn=Number.parseInt((scoreEl('turn')?.textContent||'1').split('/')[0],10);const logText=scoreEl('log')?.textContent||'';const clearMarker='ROUND '+Math.max(1,round-1)+' CLEAR';if(logText.includes(clearMarker)&&turn===1)lastClearTurn=Math.max(lastClearTurn,9);if((scoreEl('hint')?.textContent||'').includes('GAME OVER'))void saveScore();});
observer.observe(document.body,{subtree:true,childList:true,characterData:true});
loadScores();
</script>`;

export const render9GridScorePage = async (user: AuthUser | null): Promise<Response> => {
  const base = render9GridPage(user);
  const html = await base.text();
  const enhanced = html
    .replace("</main>", `${scorePanel}</main>`)
    .replace("</body>", `${scoreScript(Boolean(user))}</body>`);
  return new Response(enhanced, { status: base.status, headers: base.headers });
};
