import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://zkgfkriuahpxatgnphfj.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_RP4k0PWYjDRJsJ67x01nfA_ZgTfJecf";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ==============================
// MINI FACTORY
// ==============================

const $ = id => document.getElementById(id);

const canvas = $("world");
const ctx = canvas.getContext("2d");

let user = null;
let profile = null;

let selected = "miner";

let camera = {
  x: 0,
  y: 0
};

let dragging = false;

let lastMouse = {
  x: 0,
  y: 0
};

let lastFrame = performance.now();
let saveTimer = 0;

let state = {
  money: 500,
  iron: 0,
  plates: 0,
  energy: 0,
  buildings: []
};


// ==============================
// EDIFÍCIOS
// ==============================

const BUILDINGS = {

  miner: {
    name: "⛏️ Minerador",
    cost: 50
  },

  belt: {
    name: "➡️ Tapete",
    cost: 5
  },

  furnace: {
    name: "🔥 Fornalha",
    cost: 80
  },

  storage: {
    name: "📦 Armazém",
    cost: 40
  },

  generator: {
    name: "⚡ Gerador",
    cost: 100
  }

};


// ==============================
// CANVAS
// ==============================

function resizeCanvas() {

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 55;

}

window.addEventListener(
  "resize",
  resizeCanvas
);

resizeCanvas();


// ==============================
// AUTH
// ==============================

async function init() {

  const {
    data: {
      session
    }
  } = await supabase.auth.getSession();

  if (session) {

    user = session.user;

    await loadProfile();

    await loadFactory();

    showGame();

  }

}


async function register() {

  const email =
    $("email").value.trim();

  const password =
    $("password").value;

  const username =
    $("username").value.trim();

  if (!email || !password || !username) {

    showAuthMessage(
      "Preenche todos os campos."
    );

    return;

  }

  if (username.length < 3) {

    showAuthMessage(
      "O username precisa de pelo menos 3 caracteres."
    );

    return;

  }

  const {
    data,
    error
  } = await supabase.auth.signUp({

    email,
    password

  });

  if (error) {

    showAuthMessage(
      error.message
    );

    return;

  }

  if (!data.user) {

    showAuthMessage(
      "Confirma o email antes de entrar."
    );

    return;

  }

  const {
    error: profileError
  } = await supabase
    .from("profiles")
    .insert({

      id: data.user.id,

      username,

      is_public: true,

      factory_value: 500,

      production_per_min: 0

    });

  if (profileError) {

    showAuthMessage(
      profileError.message
    );

    return;

  }

  user = data.user;

  await loadProfile();

  await createFactory();

  showGame();

}


async function login() {

  const email =
    $("email").value.trim();

  const password =
    $("password").value;

  const {
    data,
    error
  } = await supabase.auth.signInWithPassword({

    email,

    password

  });

  if (error) {

    showAuthMessage(
      error.message
    );

    return;

  }

  user = data.user;

  await loadProfile();

  await loadFactory();

  showGame();

}


function showAuthMessage(message) {

  $("authMsg").textContent =
    message;

}


$("loginBtn").onclick =
  login;

$("signupBtn").onclick =
  register;


// ==============================
// PROFILE
// ==============================

async function loadProfile() {

  const {
    data,
    error
  } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {

    console.error(
      "Profile error:",
      error
    );

    return;

  }

  profile = data;

  $("me").textContent =
    profile.username;

  $("publicFactory").checked =
    profile.is_public;

}


async function updateProfileStats() {

  if (!user) return;

  const value =
    getFactoryValue();

  const production =
    getProductionPerMinute();

  await supabase
    .from("profiles")
    .update({

      factory_value: value,

      production_per_min: production,

      is_public:
        $("publicFactory").checked

    })
    .eq(
      "id",
      user.id
    );

}


// ==============================
// FACTORY SAVE
// ==============================

async function createFactory() {

  state = {

    money: 500,

    iron: 0,

    plates: 0,

    energy: 0,

    buildings: []

  };

  await saveFactory();

}


async function loadFactory() {

  const {
    data,
    error
  } = await supabase
    .from("factories")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {

    if (
      error.code === "PGRST116"
    ) {

      await createFactory();

    } else {

      console.error(
        "Factory error:",
        error
      );

    }

    return;

  }

  if (data?.state) {

    state = data.state;

  }

}


async function saveFactory() {

  if (!user) return;

  state.energy =
    calculateEnergy();

  const {
    error
  } = await supabase
    .from("factories")
    .upsert({

      user_id: user.id,

      state,

      updated_at:
        new Date().toISOString()

    });

  if (error) {

    console.error(
      "Save error:",
      error
    );

    return;

  }

  await updateProfileStats();

}


// ==============================
// LOGOUT
// ==============================

$("logoutBtn").onclick =
  async () => {

    await saveFactory();

    await supabase.auth.signOut();

    location.reload();

  };


// ==============================
// UI
// ==============================

function showGame() {

  $("auth").hidden = true;

  $("app").hidden = false;

}


$("saveBtn").onclick =
  async () => {

    await saveFactory();

  };


$("publicFactory").onchange =
  async () => {

    await updateProfileStats();

  };


// ==============================
// BUILDING SELECTION
// ==============================

function selectBuilding(
  type,
  button
) {

  selected = type;

  document
    .querySelectorAll(
      "#buildbar button"
    )
    .forEach(
      b =>
        b.classList.remove(
          "selected"
        )
    );

  button.classList.add(
    "selected"
  );

  $("selName").textContent =
    BUILDINGS[type].name;

  $("selInfo").textContent =
    `Custo: ${BUILDINGS[type].cost}€`;

}


document
  .querySelectorAll(
    "#buildbar button[data-type]"
  )
  .forEach(
    button => {

      button.onclick =
        () =>
          selectBuilding(
            button.dataset.type,
            button
          );

    }
  );


// ==============================
// WORLD POSITION
// ==============================

function getWorldPosition(event) {

  const rect =
    canvas.getBoundingClientRect();

  const x =
    event.clientX -
    rect.left -
    camera.x;

  const y =
    event.clientY -
    rect.top -
    camera.y;

  return {

    x:
      Math.floor(x / 40) *
        40 +
      20,

    y:
      Math.floor(y / 40) *
        40 +
      20

  };

}


// ==============================
// BUILD
// ==============================

canvas.addEventListener(
  "mousedown",
  event => {

    if (
      event.button === 2
    ) {

      dragging = true;

      lastMouse = {

        x: event.clientX,

        y: event.clientY

      };

      return;

    }

    const position =
      getWorldPosition(
        event
      );

    const building =
      BUILDINGS[selected];

    if (
      state.money <
      building.cost
    ) {

      return;

    }

    const occupied =
      state.buildings.some(
        b =>
          b.x === position.x &&
          b.y === position.y
      );

    if (occupied) return;

    state.money -=
      building.cost;

    state.buildings.push({

      type: selected,

      x: position.x,

      y: position.y

    });

    saveFactory();

  }
);


canvas.addEventListener(
  "contextmenu",
  event =>
    event.preventDefault()
);


canvas.addEventListener(
  "mousemove",
  event => {

    if (!dragging) return;

    camera.x +=
      event.clientX -
      lastMouse.x;

    camera.y +=
      event.clientY -
      lastMouse.y;

    lastMouse = {

      x: event.clientX,

      y: event.clientY

    };

  }
);


window.addEventListener(
  "mouseup",
  () =>
    dragging = false
);


// ==============================
// GAME SIMULATION
// ==============================

function calculateEnergy() {

  const generators =
    state.buildings.filter(
      b =>
        b.type === "generator"
    ).length;

  const miners =
    state.buildings.filter(
      b =>
        b.type === "miner"
    ).length;

  const furnaces =
    state.buildings.filter(
      b =>
        b.type === "furnace"
    ).length;

  return Math.max(

    0,

    generators * 20 -

    miners * 2 -

    furnaces * 6

  );

}


function simulate(
  delta
) {

  const miners =
    state.buildings.filter(
      b =>
        b.type === "miner"
    ).length;

  const furnaces =
    state.buildings.filter(
      b =>
        b.type === "furnace"
    ).length;

  const energy =
    calculateEnergy();

  state.energy =
    energy;

  if (
    energy <= 0
  ) return;

  // mineração

  state.iron +=
    miners *
    0.4 *
    delta;

  // processamento

  const processed =
    Math.min(

      state.iron,

      furnaces *
      0.2 *
      delta

    );

  state.iron -=
    processed;

  state.plates +=
    processed;

}


// ==============================
// SELL
// ==============================

$("sellBtn").onclick =
  async () => {

    const amount =
      Math.floor(
        state.plates
      );

    if (
      amount <= 0
    ) return;

    state.plates -=
      amount;

    state.money +=
      amount * 12;

    await saveFactory();

  };


// ==============================
// STATS
// ==============================

function getFactoryValue() {

  return Math.floor(

    state.money +

    state.plates * 12 +

    state.buildings.length *
      50

  );

}


function getProductionPerMinute() {

  const furnaces =
    state.buildings.filter(
      b =>
        b.type === "furnace"
    ).length;

  return Math.floor(
    furnaces * 12
  );

}


// ==============================
// LEADERBOARD
// ==============================

$("leaderBtn").onclick =
  async () => {

    const {
      data,
      error
    } = await supabase
      .from("leaderboard")
      .select("*")
      .limit(50);

    if (error) {

      openModal(
        "Erro",
        error.message
      );

      return;

    }

    if (
      !data ||
      data.length === 0
    ) {

      openModal(
        "🏆 Leaderboard",
        "<p>Ainda não existem jogadores.</p>"
      );

      return;

    }

    const html =
      data
        .map(
          (player, index) => `

          <div class="rank">

            <span>
              #${index + 1}
              ${escapeHTML(
                player.username
              )}
            </span>

            <b>
              ${player.factory_value}€
            </b>

          </div>

        `
        )
        .join("");

    openModal(
      "🏆 Leaderboard",
      html
    );

  };


// ==============================
// EXPLORE FACTORIES
// ==============================

$("exploreBtn").onclick =
  async () => {

    const {
      data,
      error
    } = await supabase
      .from("public_factories")
      .select("*")
      .limit(30);

    if (error) {

      openModal(
        "Erro",
        error.message
      );

      return;

    }

    if (
      !data ||
      data.length === 0
    ) {

      openModal(
        "🌍 Explorar",
        "<p>Nenhuma fábrica pública.</p>"
      );

      return;

    }

    const html =
      data
        .map(
          factory => `

          <div
            class="factory"
            data-user="${escapeHTML(
              factory.username
            )}"
          >

            <b>
              🏭
              ${escapeHTML(
                factory.username
              )}
            </b>

            <br>

            <span class="muted">

              Valor:
              ${factory.state?.money ?? 0}€

            </span>

          </div>

        `
        )
        .join("");

    openModal(
      "🌍 Explorar fábricas",
      html
    );

    document
      .querySelectorAll(
        ".factory"
      )
      .forEach(
        element => {

          element.onclick =
            () =>
              visitFactory(
                element.dataset.user
              );

        }
      );

  };


// ==============================
// VISIT FACTORY
// ==============================

async function visitFactory(
  username
) {

  const {
    data,
    error
  } = await supabase
    .from("public_factories")
    .select("*")
    .eq(
      "username",
      username
    )
    .single();

  if (error) {

    alert(
      "Não foi possível abrir esta fábrica."
    );

    return;

  }

  const ownState =
    JSON.parse(
      JSON.stringify(state)
    );

  state =
    data.state;

  closeModal();

  $("selInfo").textContent =
    `👀 A visitar ${username} — modo leitura`;

  setTimeout(
    () => {

      state =
        ownState;

      $("selInfo").textContent =
        "De volta à tua fábrica.";

    },
    15000
  );

}


// ==============================
// MODAL
// ==============================

function openModal(
  title,
  body
) {

  $("modalTitle")
    .textContent =
    title;

  $("modalBody")
    .innerHTML =
    body;

  $("modal").hidden =
    false;

}


function closeModal() {

  $("modal").hidden =
    true;

}


$("modal")
  .querySelector(".close")
  .onclick =
    closeModal;


// ==============================
// ESCAPE HTML
// ==============================

function escapeHTML(
  value
) {

  return String(value)
    .replace(
      /[&<>"']/g,
      char => ({

        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        '"':
          "&quot;",

        "'":
          "&#039;"

      })[char]
    );

}


// ==============================
// RENDER
// ==============================

function draw() {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  ctx.save();

  ctx.translate(
    camera.x,
    camera.y
  );

  // GRID

  ctx.strokeStyle =
    "#222";

  const startX =
    Math.floor(
      -camera.x / 40
    ) *
      40 -
    40;

  const startY =
    Math.floor(
      -camera.y / 40
    ) *
      40 -
    40;

  for (
    let x = startX;
    x <
    startX +
      canvas.width +
      120;
    x += 40
  ) {

    ctx.beginPath();

    ctx.moveTo(
      x,
      -camera.y
    );

    ctx.lineTo(
      x,
      canvas.height -
        camera.y
    );

    ctx.stroke();

  }

  for (
    let y = startY;
    y <
    startY +
      canvas.height +
      120;
    y += 40
  ) {

    ctx.beginPath();

    ctx.moveTo(
      -camera.x,
      y
    );

    ctx.lineTo(
      canvas.width -
        camera.x,
      y
    );

    ctx.stroke();

  }


  // BUILDINGS

  for (
    const building
    of state.buildings
  ) {

    let color =
      "#777";

    let icon =
      "❔";

    if (
      building.type ===
      "miner"
    ) {

      color =
        "#98703d";

      icon =
        "⛏️";

    }

    if (
      building.type ===
      "belt"
    ) {

      color =
        "#777";

      icon =
        "➡️";

    }

    if (
      building.type ===
      "furnace"
    ) {

      color =
        "#9b4835";

      icon =
        "🔥";

    }

    if (
      building.type ===
      "storage"
    ) {

      color =
        "#496b96";

      icon =
        "📦";

    }

    if (
      building.type ===
      "generator"
    ) {

      color =
        "#a18b35";

      icon =
        "⚡";

    }

    ctx.fillStyle =
      color;

    ctx.fillRect(

      building.x - 17,

      building.y - 17,

      34,

      34

    );

    ctx.font =
      "18px Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(

      icon,

      building.x,

      building.y + 6

    );

  }

  ctx.restore();


  $("money")
    .textContent =
    Math.floor(
      state.money
    );

  $("iron")
    .textContent =
    Math.floor(
      state.iron
    );

  $("plates")
    .textContent =
    Math.floor(
      state.plates
    );

  $("energy")
    .textContent =
    Math.floor(
      state.energy
    );

}


// ==============================
// GAME LOOP
// ==============================

function loop(
  now
) {

  const delta =
    Math.min(
      0.1,
      (now -
        lastFrame) /
        1000
    );

  lastFrame =
    now;

  simulate(
    delta
  );

  draw();

  saveTimer +=
    delta;

  if (
    saveTimer >= 15
  ) {

    saveTimer = 0;

    saveFactory();

  }

  requestAnimationFrame(
    loop
  );

}


// ==============================
// START
// ==============================

init();

requestAnimationFrame(
  loop
);
