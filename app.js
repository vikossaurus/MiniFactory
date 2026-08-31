import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://zkgfkriuahpxatgnphfj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RP4k0PWYjDRJsJ67x01nfA_ZgTfJecf";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);

const canvas = $("world");
const ctx = canvas.getContext("2d");

let user = null;
let profile = null;
let selected = "miner";
let viewing = null;
let saveTimer = 0;
let lastTime = performance.now();

const camera = {x:0,y:0};
let pointer = {x:0,y:0};
let moved = false;
let placing = false;

let state = {
  money:500,
  iron:0,
  plates:0,
  energy:0,
  buildings:[]
};

const BUILDINGS = {
  miner:{name:"⛏️ Minerador",cost:50},
  belt:{name:"➡️ Tapete",cost:5},
  furnace:{name:"🔥 Fornalha",cost:80},
  storage:{name:"📦 Armazém",cost:40},
  generator:{name:"⚡ Gerador",cost:100}
};

const COLORS = {
  miner:"#9b733e",
  belt:"#777d86",
  furnace:"#9b4939",
  storage:"#4c6f9d",
  generator:"#a28d3d"
};

const ICONS = {
  miner:"⛏️",
  belt:"➡️",
  furnace:"🔥",
  storage:"📦",
  generator:"⚡"
};

function resize(){
  canvas.width = innerWidth;
  canvas.height = innerHeight - ($("app").hidden ? 0 : $("world").offsetTop);
}
addEventListener("resize", resize);

function toast(text){
  const el=$("toast");
  el.textContent=text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.remove("show"),1800);
}

function escapeHTML(v){
  return String(v).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);
}

function setAuthMessage(text){
  $("authMsg").textContent=text;
}

async function init(){
  resize();
  const {data:{session}}=await supabase.auth.getSession();
  if(session){
    user=session.user;
    const ok=await loadProfile();
    if(ok){
      await loadFactory();
      showGame();
    }
  }
}

async function register(){
  const email=$("email").value.trim();
  const password=$("password").value;
  const username=$("username").value.trim();

  if(!email||!password||!username)
    return setAuthMessage("Preenche email, password e username.");

  if(username.length<3)
    return setAuthMessage("O username precisa de 3-20 caracteres.");

  const {data,error}=await supabase.auth.signUp({email,password});
  if(error) return setAuthMessage(error.message);

  if(!data.user)
    return setAuthMessage("Confirma o email e depois entra.");

  const {error:profileError}=await supabase.from("profiles").insert({
    id:data.user.id,
    username,
    is_public:true,
    factory_value:500,
    production_per_min:0
  });

  if(profileError){
    return setAuthMessage(
      profileError.code==="23505"
        ?"Esse username já existe."
        :profileError.message
    );
  }

  user=data.user;
  await loadProfile();
  await loadFactory();
  showGame();
  toast("Conta criada!");
}

async function login(){
  const email=$("email").value.trim();
  const password=$("password").value;

  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) return setAuthMessage(error.message);

  user=data.user;
  if(await loadProfile()){
    await loadFactory();
    showGame();
  }
}

$("loginBtn").onclick=login;
$("signupBtn").onclick=register;

async function loadProfile(){
  const {data,error}=await supabase
    .from("profiles")
    .select("*")
    .eq("id",user.id)
    .single();

  if(error){
    setAuthMessage("Perfil não encontrado. Executa o SQL do projeto.");
    console.error(error);
    return false;
  }

  profile=data;
  $("me").textContent=profile.username;
  $("publicFactory").checked=!!profile.is_public;
  return true;
}

async function loadFactory(){
  const {data,error}=await supabase
    .from("factories")
    .select("state")
    .eq("user_id",user.id)
    .maybeSingle();

  if(error){
    toast("Erro a carregar a fábrica.");
    console.error(error);
    return;
  }

  if(data?.state){
    state=normaliseState(data.state);
  }else{
    await saveFactory();
  }
}

function normaliseState(s){
  return {
    money:Number(s?.money) || 500,
    iron:Number(s?.iron) || 0,
    plates:Number(s?.plates) || 0,
    energy:Number(s?.energy) || 0,
    buildings:Array.isArray(s?.buildings) ? s.buildings : []
  };
}

async function saveFactory(){
  if(!user || viewing) return;

  state.energy=calculateEnergy();

  const {error}=await supabase.from("factories").upsert({
    user_id:user.id,
    state,
    updated_at:new Date().toISOString()
  });

  if(error){
    console.error(error);
    toast("Não foi possível guardar.");
    return;
  }

  await updateStats();
}

async function updateStats(){
  if(!user || viewing) return;

  const {error}=await supabase.from("profiles").update({
    factory_value:getFactoryValue(),
    production_per_min:getProductionPerMinute(),
    is_public:$("publicFactory").checked
  }).eq("id",user.id);

  if(error) console.error(error);
}

$("saveBtn").onclick=async()=>{
  await saveFactory();
  toast("Guardado!");
};

$("logoutBtn").onclick=async()=>{
  await saveFactory();
  await supabase.auth.signOut();
  location.reload();
};

$("publicFactory").onchange=updateStats;

function showGame(){
  $("auth").hidden=true;
  $("app").hidden=false;
  resize();
  selectBuilding("miner");
}

function selectBuilding(type){
  if(!BUILDINGS[type]) return;
  selected=type;
  document.querySelectorAll("#buildbar button[data-type]")
    .forEach(b=>b.classList.toggle("selected",b.dataset.type===type));

  $("selName").textContent=BUILDINGS[type].name;
  $("selInfo").textContent=`Custo: ${BUILDINGS[type].cost}€`;
}

document.querySelectorAll("#buildbar button[data-type]")
  .forEach(b=>b.onclick=()=>selectBuilding(b.dataset.type));

$("sellBtn").onclick=async()=>{
  if(viewing) return;
  const amount=Math.floor(state.plates);
  if(amount<=0) return toast("Não tens barras para vender.");
  state.plates-=amount;
  state.money+=amount*12;
  await saveFactory();
  toast(`Vendeste ${amount} barras!`);
};

function worldFromScreen(clientX,clientY){
  const rect=canvas.getBoundingClientRect();
  const x=clientX-rect.left-camera.x;
  const y=clientY-rect.top-camera.y;
  return {
    x:Math.floor(x/40)*40+20,
    y:Math.floor(y/40)*40+20
  };
}

function occupied(x,y){
  return state.buildings.some(b=>b.x===x&&b.y===y);
}

function placeAt(clientX,clientY){
  if(viewing) return;
  const p=worldFromScreen(clientX,clientY);
  const def=BUILDINGS[selected];

  if(state.money<def.cost){
    toast("Dinheiro insuficiente!");
    return;
  }
  if(occupied(p.x,p.y)){
    toast("Esse espaço já está ocupado.");
    return;
  }

  state.money-=def.cost;
  state.buildings.push({type:selected,x:p.x,y:p.y});
  saveFactory();
}

canvas.addEventListener("pointerdown",e=>{
  canvas.setPointerCapture(e.pointerId);
  pointer={x:e.clientX,y:e.clientY};
  moved=false;
  placing=true;
});

canvas.addEventListener("pointermove",e=>{
  if(!placing) return;
  const dx=e.clientX-pointer.x;
  const dy=e.clientY-pointer.y;

  if(Math.abs(dx)+Math.abs(dy)>6){
    moved=true;
    camera.x+=dx;
    camera.y+=dy;
    pointer={x:e.clientX,y:e.clientY};
  }
});

canvas.addEventListener("pointerup",e=>{
  if(!placing) return;
  placing=false;
  if(!moved) placeAt(e.clientX,e.clientY);
});

canvas.addEventListener("pointercancel",()=>placing=false);

canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  camera.x-=e.deltaX;
  camera.y-=e.deltaY;
},{passive:false});

function calculateEnergy(){
  const generators=state.buildings.filter(b=>b.type==="generator").length;
  const miners=state.buildings.filter(b=>b.type==="miner").length;
  const furnaces=state.buildings.filter(b=>b.type==="furnace").length;
  return Math.max(0,generators*20-miners*2-furnaces*6);
}

function simulate(dt){
  if(viewing) return;

  const miners=state.buildings.filter(b=>b.type==="miner").length;
  const furnaces=state.buildings.filter(b=>b.type==="furnace").length;

  state.energy=calculateEnergy();

  if(state.energy<=0) return;

  state.iron+=miners*0.4*dt;

  const processed=Math.min(
    state.iron,
    furnaces*0.2*dt
  );

  state.iron-=processed;
  state.plates+=processed;
}

function getFactoryValue(){
  return Math.floor(
    state.money+
    state.plates*12+
    state.buildings.length*50
  );
}

function getProductionPerMinute(){
  return Math.floor(
    state.buildings.filter(b=>b.type==="furnace").length*12
  );
}

async function showLeaderboard(){
  const {data,error}=await supabase
    .from("leaderboard")
    .select("*")
    .limit(50);

  if(error){
    return openModal("Erro",escapeHTML(error.message));
  }

  const rows=(data||[]).map((p,i)=>`
    <div class="rank">
      <span>#${i+1} ${escapeHTML(p.username)}</span>
      <b>${Number(p.factory_value||0).toLocaleString("pt-PT")}€</b>
    </div>
  `).join("");

  openModal("🏆 Leaderboard",rows||"<p class='muted'>Ainda não há jogadores.</p>");
}

$("leaderBtn").onclick=showLeaderboard;

async function showFactories(){
  const {data,error}=await supabase
    .from("public_factories")
    .select("username,factory_value,production_per_min,updated_at")
    .limit(50);

  if(error){
    return openModal("Erro",escapeHTML(error.message));
  }

  const rows=(data||[]).map(p=>`
    <div class="factory" data-name="${escapeHTML(p.username)}">
      <b>🏭 ${escapeHTML(p.username)}</b>
      <br>
      <span class="muted">
        ${Number(p.factory_value||0).toLocaleString("pt-PT")}€
        · ${Number(p.production_per_min||0).toLocaleString("pt-PT")}/min
      </span>
    </div>
  `).join("");

  openModal(
    "🌍 Fábricas públicas",
    rows||"<p class='muted'>Nenhuma fábrica pública.</p>"
  );

  document.querySelectorAll(".factory").forEach(el=>{
    el.onclick=()=>visitFactory(el.dataset.name);
  });
}

$("exploreBtn").onclick=showFactories;

async function visitFactory(username){
  const {data,error}=await supabase
    .from("public_factories")
    .select("username,state")
    .eq("username",username)
    .single();

  if(error || !data) return toast("Fábrica indisponível.");

  closeModal();

  viewing={
    username,
    previous:JSON.parse(JSON.stringify(state))
  };

  state=normaliseState(data.state);
  camera.x=0;
  camera.y=0;

  $("selName").textContent=`👀 ${username}`;
  $("selInfo").textContent="Modo visita — não podes alterar esta fábrica.";
  toast(`A visitar ${username}`);

  setTimeout(()=>{
    if(!viewing || viewing.username!==username) return;
    state=viewing.previous;
    viewing=null;
    $("selName").textContent="Construção";
    $("selInfo").textContent="De volta à tua fábrica.";
    toast("Voltaste à tua fábrica.");
  },15000);
}

function openModal(title,body){
  $("modalTitle").textContent=title;
  $("modalBody").innerHTML=body;
  $("modal").hidden=false;
}

function closeModal(){
  $("modal").hidden=true;
}

$("closeModal").onclick=closeModal;
$("modal").addEventListener("pointerdown",e=>{
  if(e.target===$("modal")) closeModal();
});

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.save();
  ctx.translate(camera.x,camera.y);

  const size=40;
  const left=Math.floor((-camera.x-100)/size)*size;
  const top=Math.floor((-camera.y-100)/size)*size;

  ctx.strokeStyle="#20242b";
  ctx.lineWidth=1;

  for(let x=left;x<left+canvas.width+250;x+=size){
    ctx.beginPath();
    ctx.moveTo(x,-camera.y-100);
    ctx.lineTo(x,canvas.height-camera.y+100);
    ctx.stroke();
  }

  for(let y=top;y<top+canvas.height+250;y+=size){
    ctx.beginPath();
    ctx.moveTo(-camera.x-100,y);
    ctx.lineTo(canvas.width-camera.x+100,y);
    ctx.stroke();
  }

  for(const b of state.buildings){
    ctx.fillStyle=COLORS[b.type]||"#666";
    ctx.fillRect(b.x-17,b.y-17,34,34);

    ctx.strokeStyle="#ffffff22";
    ctx.strokeRect(b.x-17,b.y-17,34,34);

    ctx.font="18px Arial";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(ICONS[b.type]||"?",b.x,b.y);
  }

  ctx.restore();

  $("money").textContent=Math.floor(state.money).toLocaleString("pt-PT");
  $("iron").textContent=Math.floor(state.iron).toLocaleString("pt-PT");
  $("plates").textContent=Math.floor(state.plates).toLocaleString("pt-PT");
  $("energy").textContent=Math.floor(state.energy).toLocaleString("pt-PT");
}

function loop(now){
  const dt=Math.min(.1,(now-lastTime)/1000);
  lastTime=now;

  simulate(dt);
  draw();

  saveTimer+=dt;
  if(saveTimer>=15 && !viewing){
    saveTimer=0;
    saveFactory();
  }

  requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);
