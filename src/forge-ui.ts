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

export const renderForgePage = (user: AuthUser | null): Response => {
  const login = user ? "" : `<div class="login-lock"><strong>LOGIN REQUIRED</strong><span>대장간 진행 데이터는 로그인한 계정에 저장됩니다.</span><a href="/auth/kakao">KAKAO LOGIN</a></div>`;
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Forge — 오늘도 강화</title>
<style>
:root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#090b0c;color:#e4e9eb}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#2a2117 0,#0b0d0f 48%,#070809 100%);padding:12px}
.app{max-width:1180px;margin:auto;border:1px solid #65543f;background:#0d1012;box-shadow:0 18px 50px #000;padding:14px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #4a4033;padding:8px 4px 14px}.brand{font-weight:900;letter-spacing:2px}.muted{color:#8c979d;font-size:12px}.user{display:flex;align-items:center;gap:10px}a,button{font:inherit;color:#e4e9eb;text-decoration:none;background:#15191c;border:1px solid #675b4d;padding:9px 12px;cursor:pointer}button:hover,a:hover{background:#211d18}button:disabled{opacity:.45;cursor:not-allowed}
.hero{padding:26px 4px 18px}.hero h1{margin:0 0 6px;font-size:clamp(30px,6vw,58px);letter-spacing:4px}.hero p{margin:0;color:#9da5a9}.login-lock{display:flex;gap:12px;align-items:center;border:1px solid #785e40;background:#17130e;padding:12px;margin-bottom:14px}.login-lock span{color:#a9a39b;font-size:12px;flex:1}
.layout{display:grid;grid-template-columns:1.15fr .85fr;gap:14px}.panel{border:1px solid #4a4033;background:#101416;padding:16px}.panel h2{font-size:14px;letter-spacing:2px;margin:0 0 14px;color:#d7c3a4}.gold{font-size:26px;font-weight:900}.shop{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.weapon-card{border:1px solid #3f464a;background:#13181b;padding:12px}.weapon-card strong{display:block;margin-bottom:7px}.stat{color:#9ca6aa;font-size:12px;margin:4px 0}.weapon-card button{width:100%;margin-top:9px}.weapon-main{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;border:1px solid #544737;background:#17130e;padding:16px;margin-bottom:12px}.weapon-name{font-size:22px;font-weight:900}.enhance{font-size:42px;font-weight:900;color:#d5a867}.damage{font-size:20px}.rate{font-size:13px;color:#b8a68d;margin-top:6px}.main-actions{display:flex;gap:8px;flex-wrap:wrap}.primary{font-weight:900;min-width:150px}.danger{border-color:#744b43}.skills{display:grid;gap:9px}.skill{border:1px solid #3f464a;padding:11px;background:#13181b}.skill-row{display:flex;justify-content:space-between;gap:10px;align-items:center}.skill-name{font-weight:800}.skill-desc{color:#929da2;font-size:11px;margin:5px 0 9px}.log{max-height:190px;overflow:auto;background:#090c0e;border:1px solid #30373a;padding:10px;font-size:12px;line-height:1.7}.ok{color:#b6d7b2}.great{color:#e4c17c}.fail{color:#d39a8e}.error{color:#d58d8d}.empty{color:#788389}
.footer{margin-top:14px;padding-top:12px;border-top:1px solid #292e31;color:#69747a;font-size:11px;display:flex;justify-content:space-between;gap:8px}
@media(max-width:760px){body{padding:6px}.app{padding:10px}.top{align-items:flex-start;flex-direction:column}.user{width:100%;justify-content:space-between}.layout{grid-template-columns:1fr}.shop{grid-template-columns:1fr}.weapon-main{grid-template-columns:1fr}.enhance{font-size:34px}.login-lock{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<main class="app">
<header class="top"><div><div class="brand">FORGE // BLACKSMITH</div><div class="muted">terminal://games/forge</div></div><div class="user"><span class="muted">${userLabel(user)}</span><a href="/">PORTAL</a></div></header>
<section class="hero"><h1>오늘도 강화</h1><p>무기를 사고, 두 배의 피해를 노리고, 실패하면 다시 시작하세요.</p></section>
${login}
<div id="game" class="layout" ${user ? "" : "hidden"}>
<section class="panel"><h2>BLACKSMITH SHOP</h2><div class="gold">GOLD <span id="gold">-</span> G</div><div class="shop" id="shop"></div><div class="main-actions" style="margin-top:10px"><button id="refresh" type="button">REFRESH SHOP</button></div></section>
<section class="panel"><h2>CURRENT WEAPON</h2><div class="weapon-main"><div><div id="weaponName" class="weapon-name">-</div><div id="weaponDamage" class="damage">DMG -</div><div id="upgradeRate" class="rate">SUCCESS -</div><div id="greatRate" class="rate">GREAT -</div></div><div id="enhance" class="enhance">+0</div></div><div class="main-actions"><button id="upgrade" class="primary" type="button">HAMMER // UPGRADE</button><button id="sell" class="danger" type="button">SELL WEAPON</button></div></section>
<section class="panel"><h2>BLACKSMITH SKILLS</h2><div id="skills" class="skills"></div></section>
<section class="panel"><h2>ACTION LOG</h2><div id="log" class="log"><div class="empty">&gt; forge session starting...</div></div></section>
</div>
<footer class="footer"><span>SERVER AUTHORITATIVE · RNG ON SERVER · VERSIONED ACTIONS</span><span>ACCOUNT: ${user ? "AUTHENTICATED" : "GUEST"}</span></footer>
</main>
<script>
const AUTH=${user ? "true" : "false"};
let session=null;
let busy=false;
const $=(id)=>document.getElementById(id);
const text=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
const escText=(value)=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const makeId=()=>crypto.randomUUID().replaceAll('-','').slice(0,32);
async function json(url,options){const response=await fetch(url,options);const body=await response.json().catch(()=>null);if(!response.ok){const error=new Error(body?.error||'REQUEST FAILED');error.status=response.status;throw error;}return body;}
function addLog(message,kind=''){const log=$('log');if(!log)return;const line=document.createElement('div');line.className=kind;line.textContent='> '+message;log.appendChild(line);while(log.children.length>30)log.removeChild(log.firstChild);log.scrollTop=log.scrollHeight;}
function formatSkill(skill){return skill==='enhancementBonusLevel'?'숙련된 대장장이':skill==='greatSuccessLevel'?'대장장이의 감':'장사의 달인';}
function render(){if(!session)return;text('gold',session.gold);const weapon=session.currentWeapon;if(weapon){text('weaponName',weapon.name);text('weaponDamage','DMG '+session.currentDamage);text('enhance','+'+weapon.enhancementLevel);const base=[90,80,70,60,50,40,30,20,10,5][weapon.enhancementLevel]??0;text('upgradeRate','SUCCESS '+Math.min(100,base+session.skills.enhancementBonusLevel)+'% · COST '+weapon.enhancementLevel+' G');text('greatRate','GREAT +2 '+Math.min(100,session.skills.greatSuccessLevel)+'%');}else{text('weaponName','NO WEAPON');text('weaponDamage','DMG 0');text('enhance','--');text('upgradeRate','구매 후 강화할 수 있습니다.');text('greatRate','GREAT --');}
const shop=$('shop');shop.innerHTML='';session.shopWeapons.forEach((weapon)=>{const card=document.createElement('div');card.className='weapon-card';card.innerHTML='<strong>'+escText(weapon.name)+'</strong><div class="stat">BASE DMG '+weapon.baseDamage+'</div><div class="stat">PRICE '+weapon.baseDamage+' G</div>';const button=document.createElement('button');button.type='button';button.textContent='BUY';button.disabled=busy||session.gold<weapon.baseDamage;button.addEventListener('click',()=>act('BUY_WEAPON',{weaponId:weapon.id}));card.appendChild(button);shop.appendChild(card);});
const skills=$('skills');skills.innerHTML='';['enhancementBonusLevel','greatSuccessLevel','sellBonusLevel'].forEach((skill)=>{const level=session.skills[skill];const base=skill==='enhancementBonusLevel'?25:skill==='greatSuccessLevel'?50:30;const cost=base*2**level;const card=document.createElement('div');card.className='skill';card.innerHTML='<div class="skill-row"><span class="skill-name">'+formatSkill(skill)+'</span><span>LV '+level+'</span></div><div class="skill-desc">'+(skill==='enhancementBonusLevel'?'강화 성공 확률 +1%p':skill==='greatSuccessLevel'?'+2 강화 확률 +1%p':'판매가 +1%')+'</div>';const button=document.createElement('button');button.type='button';button.textContent=level>=20?'MAX':'BUY · '+cost+' G';button.disabled=busy||level>=20||session.gold<cost;button.addEventListener('click',()=>act('BUY_SKILL',{skill}));card.appendChild(button);skills.appendChild(card);});
$('upgrade').disabled=busy||!weapon||weapon.enhancementLevel>=10||session.gold<weapon.enhancementLevel;$('sell').disabled=busy||!weapon;$('refresh').disabled=busy;
}
async function load(){if(!AUTH)return;try{session=await json('/api/games/forge/session');render();addLog('SESSION READY · V'+session.version);}catch(error){addLog('SESSION LOAD FAILED','error');}}
async function act(action,extra={}){if(!session||busy)return;busy=true;render();const version=session.version;const actionId=makeId();try{const body=await json('/api/games/forge/session/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,actionId,version,...extra})});session=body;const result=body.lastAction;const kind=result?.kind;if(kind==='great_success')addLog('CRITICAL! +2 ENHANCEMENT · +'+(result.weapon?.enhancementLevel??'?'),'great');else if(kind==='success')addLog('HAMMER HIT · +'+(result.weapon?.enhancementLevel??'?'),'ok');else if(kind==='failed')addLog('BOOM... WEAPON DESTROYED','fail');else if(kind==='buy_weapon')addLog('PURCHASED '+(result.weapon?.name??'WEAPON'),'ok');else if(kind==='sell_weapon')addLog('SOLD · +'+result.price+' G','ok');else if(kind==='buy_skill')addLog(formatSkill(result.skill)+' → LV '+result.level,'ok');else if(kind==='refresh_shop')addLog('SHOP REFRESHED');}catch(error){if(error.status===409){addLog('SESSION UPDATED · RELOADING','error');try{session=await json('/api/games/forge/session');}catch{}}else addLog(error.message||'ACTION FAILED','error');}finally{busy=false;render();}}
$('refresh')?.addEventListener('click',()=>act('REFRESH_SHOP'));
$('upgrade')?.addEventListener('click',()=>act('UPGRADE'));
$('sell')?.addEventListener('click',()=>act('SELL_WEAPON'));
load();
</script>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" } });
};
