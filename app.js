import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "COLE_AQUI_O_SUPABASE_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_A_ANON_KEY";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $=id=>document.getElementById(id);
let user=null, profile=null, selected="miner", dragging=false, last={x:0,y:0};
let cam={x:0,y:0}, lastFrame=performance.now(), saveTimer=0;
let state={money:500,iron:0,plates:0,energy:0,buildings:[]};
const defs={
 miner:{name:"⛏ Minerador",cost:50},
 belt:{name:"➡ Tapete",cost:5},
 furnace:{name:"🔥 Fornalha",cost:80},
 storage:{name:"📦 Armazém",cost:40},
 generator:{name:"⚡ Gerador",cost:100}
};
const canvas=$("world"),ctx=canvas.getContext("2d");
function resize(){canvas.width=innerWidth;canvas.height=innerHeight-55} addEventListener("resize",resize);resize();

async function boot(){
 const {data:{session}}=await sb.auth.getSession();
 if(session){user=session.user;await loadProfile();await loadFactory();showApp();}
}
async function loadProfile(){
 const {data,error}=await sb.from("profiles").select("*").eq("id",user.id).single();
 if(error) console.error(error); profile=data;
 if(profile){$("me").textContent=profile.username;$("publicFactory").checked=profile.is_public}
}
async function loadFactory(){
 const {data,error}=await sb.from("factories").select("*").eq("user_id",user.id).single();
 if(error && error.code!=="PGRST116") console.error(error);
 if(data) state=data.state;
 else await saveGame(true);
}
async function saveGame(silent=false){
 if(!user)return;
 const value={...state,energy:calcEnergy()};
 const {error}=await sb.from("factories").upsert({user_id:user.id,state:value,updated_at:new Date().toISOString()});
 if(error&&!silent) alert("Erro ao guardar: "+error.message);
 if(profile) await sb.from("profiles").update({factory_value:factoryValue(value),production_per_min:productionPerMin(value),is_public:$("publicFactory").checked}).eq("id",user.id);
}
function showApp(){$("auth").hidden=true;$("app").hidden=false}
function msg(t){$("authMsg").textContent=t}
$("loginBtn").onclick=async()=>{
 const {data,error}=await sb.auth.signInWithPassword({email:$("email").value,password:$("password").value});
 if(error)return msg(error.message);user=data.user;await loadProfile();await loadFactory();showApp();
};
$("signupBtn").onclick=async()=>{
 const email=$("email").value,password=$("password").value,name=$("username").value.trim();
 if(!name)return msg("Escolhe um username.");
 const {data,error}=await sb.auth.signUp({email,password});
 if(error)return msg(error.message);
 if(!data.user)return msg("Confirma o email e depois entra.");
 const {error:e}=await sb.from("profiles").insert({id:data.user.id,username:name});
 if(e)return msg(e.message);
 user=data.user;await loadProfile();await loadFactory();showApp();
};
$("logoutBtn").onclick=async()=>{await saveGame(true);await sb.auth.signOut();location.reload()};
$("saveBtn").onclick=()=>saveGame();
$("publicFactory").onchange=()=>saveGame(true);
document.querySelectorAll("#buildbar button[data-type]").forEach(b=>b.onclick=()=>selectBuilding(b.dataset.type,b));
function selectBuilding(t,b){selected=t;document.querySelectorAll("#buildbar button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");$("selName").textContent=defs[t].name;$("selInfo").textContent=`Custo: ${defs[t].cost}€`}

function pos(e){const r=canvas.getBoundingClientRect();return{x:Math.floor((e.clientX-r.left-cam.x)/40)*40+20,y:Math.floor((e.clientY-r.top-cam.y)/40)*40+20}}
canvas.onmousedown=e=>{
 if(e.button===2){dragging=true;last={x:e.clientX,y:e.clientY};return}
 const p=pos(e), cost=defs[selected].cost;
 if(state.money<cost)return;
 if(state.buildings.some(b=>b.x===p.x&&b.y===p.y))return;
 state.money-=cost;state.buildings.push({type:selected,x:p.x,y:p.y});saveGame(true);
};
canvas.oncontextmenu=e=>e.preventDefault();
canvas.onmousemove=e=>{if(dragging){cam.x+=e.clientX-last.x;cam.y+=e.clientY-last.y;last={x:e.clientX,y:e.clientY}}};
onmouseup=()=>dragging=false;

function calcEnergy(){return Math.max(0,state.buildings.filter(b=>b.type==="generator").length*20-state.buildings.filter(b=>b.type==="miner").length*2-state.buildings.filter(b=>b.type==="furnace").length*6)}
function simulate(dt){
 const m=state.buildings.filter(b=>b.type==="miner").length;
 const f=state.buildings.filter(b=>b.type==="furnace").length;
 if(calcEnergy()>0){state.iron+=m*.4*dt;const x=Math.min(state.iron,f*.2*dt);state.iron-=x;state.plates+=x}
 state.energy=calcEnergy();
}
$("sellBtn").onclick=()=>{let n=Math.floor(state.plates);if(n){state.plates-=n;state.money+=n*12;saveGame(true)}};
function factoryValue(s=state){return Math.floor(s.money+s.plates*12+s.buildings.length*50)}
function productionPerMin(s=state){return Math.floor(s.buildings.filter(b=>b.type==="furnace").length*12)}

$("leaderBtn").onclick=async()=>{
 const {data,error}=await sb.from("leaderboard").select("*").limit(50);
 if(error)return openModal("Erro",error.message);
 openModal("🏆 Leaderboard",data.map((x,i)=>`<div class="rank"><span>#${i+1} ${esc(x.username)}</span><b>${x.factory_value}€</b></div>`).join("")||"<p>Sem jogadores.</p>");
};
$("exploreBtn").onclick=async()=>{
 const {data,error}=await sb.from("profiles").select("username,factory_value,production_per_min").eq("is_public",true).order("factory_value",{ascending:false}).limit(30);
 if(error)return openModal("Erro",error.message);
 openModal("🌍 Explorar fábricas",data.map(x=>`<div class="factory" data-name="${esc(x.username)}"><b>${esc(x.username)}</b><br><span class="muted">${x.factory_value}€ · ${x.production_per_min}/min</span></div>`).join("")||"<p>Nenhuma fábrica pública.</p>");
 document.querySelectorAll(".factory").forEach(el=>el.onclick=()=>visit(el.dataset.name));
};
async function visit(name){
 const {data,error}=await sb.from("public_factories").select("*").eq("username",name).single();
 if(error)return alert("Não foi possível abrir a fábrica.");
 const old=state;state=data.state;cam={x:0,y:0};
 closeModal();$("selInfo").textContent=`A visitar ${name} (modo leitura).`;
 setTimeout(()=>{state=old;$("selInfo").textContent="De volta à tua fábrica.";},15000);
}
function openModal(title,body){$("modalTitle").textContent=title;$("modalBody").innerHTML=body;$("modal").hidden=false}
function closeModal(){$("modal").hidden=true}
$("modal").querySelector(".close").onclick=closeModal;
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}

function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(cam.x,cam.y);
 const sx=Math.floor(-cam.x/40)*40-40, sy=Math.floor(-cam.y/40)*40-40;
 ctx.strokeStyle="#222";
 for(let x=sx;x<sx+canvas.width+100;x+=40){ctx.beginPath();ctx.moveTo(x,-cam.y);ctx.lineTo(x,canvas.height-cam.y);ctx.stroke()}
 for(let y=sy;y<sy+canvas.height+100;y+=40){ctx.beginPath();ctx.moveTo(-cam.x,y);ctx.lineTo(canvas.width-cam.x,y);ctx.stroke()}
 for(const b of state.buildings){
  const c={miner:"#9a713e",belt:"#777",furnace:"#9b4835",storage:"#496b96",generator:"#a18b35"}[b.type];
  const icon={miner:"⛏",belt:"→",furnace:"🔥",storage:"📦",generator:"⚡"}[b.type];
  ctx.fillStyle=c;ctx.fillRect(b.x-17,b.y-17,34,34);ctx.font="18px Arial";ctx.textAlign="center";ctx.fillText(icon,b.x,b.y+6);
 }
 ctx.restore();
 $("money").textContent=Math.floor(state.money);$("iron").textContent=Math.floor(state.iron);$("plates").textContent=Math.floor(state.plates);$("energy").textContent=Math.floor(state.energy);
}
function loop(t){const dt=Math.min(.1,(t-lastFrame)/1000);lastFrame=t;simulate(dt);draw();saveTimer+=dt;if(saveTimer>15){saveTimer=0;saveGame(true)}requestAnimationFrame(loop)}
boot();requestAnimationFrame(loop);
