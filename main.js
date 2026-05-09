/**
 * ============================================================
 * LEKTÍLL — The First Offering
 * Vanilla JS + HTML5 Canvas top-down narrative exploration
 *
 * Main systems:
 * 1. Tile map — each area is a 2D char grid decoded at runtime.
 * 2. Player — smooth pixel movement with AABB tile collision.
 * 3. Dialogue — queue of {speaker, lines}; blocks movement while open.
 * 4. Story flags — booleans gate the northern path, cutscene, ending.
 * 5. Map transitions — rectangular zones teleport the player + swap map.
 * ============================================================
 */

// --- Canvas & timing -------------------------------------------------
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const TILE = 32;
const MAP_W = 25;
const MAP_H = 18;
const CANVAS_W = MAP_W * TILE;
const CANVAS_H = MAP_H * TILE;

canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// --- Palette (dark fantasy, wet earth, cyan bioluminescence) -------
const C = {
  void: "#030405",
  stone: "#1a2220",
  stoneHi: "#2a3532",
  soil: "#3d2f22",
  soilWet: "#2a2118",
  grass: "#2d3a28",
  grassHi: "#3a4a34",
  wood: "#4a3528",
  water: "#1a3035",
  waterHi: "#2a4a52",
  glow: "#5ee6c8",
  glowDim: "#2a8a78",
  glowCore: "#b8fff0",
  scale: "#1c2824",
  scaleEdge: "#0e1512",
  playerBody: "#2c3540",
  playerHead: "#c4b8a8",
  text: "#d8e8df",
  uiBg: "rgba(6,10,8,0.92)",
  uiBorder: "#3a5a50",
};

// --- Story flags (required by spec) --------------------------------
const gameState = {
  talkedToMother: false,
  talkedToTaylor: false,
  talkedToFarmer: false,
  talkedToWorshipper: false,
  lektillAwakened: false,
  missionStarted: false,
  hasBulbisLazul: false,
  gameFinished: false,
  exitedAfterEnd: false,
};

// --- Input -----------------------------------------------------------
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  handleGlobalKeys(e);
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function isInteractPressed() {
  return keys["KeyE"] === true || keys["Space"] === true;
}

function isUp() {
  return keys["KeyW"] === true || keys["ArrowUp"] === true;
}
function isDown() {
  return keys["KeyS"] === true || keys["ArrowDown"] === true;
}
function isLeft() {
  return keys["KeyA"] === true || keys["ArrowLeft"] === true;
}
function isRight() {
  return keys["KeyD"] === true || keys["ArrowRight"] === true;
}

// --- Dialogue system -------------------------------------------------
/** @type {{ speaker: string, lines: string[] } | null} */
let activeDialogue = null;
let dialogueLineIndex = 0;
let interactLatch = false;

function startDialogue(speaker, lines) {
  activeDialogue = { speaker, lines };
  dialogueLineIndex = 0;
}

function closeDialogue() {
  activeDialogue = null;
  dialogueLineIndex = 0;
}

function dialogueIsOpen() {
  return activeDialogue !== null;
}

function advanceDialogue() {
  if (!activeDialogue) return;
  dialogueLineIndex++;
  if (dialogueLineIndex >= activeDialogue.lines.length) {
    closeDialogue();
  }
}

// --- Player ----------------------------------------------------------
const player = {
  x: 3 * TILE + 6,
  y: 8 * TILE + 6,
  w: 20,
  h: 20,
  speed: 2.4,
};

let currentMapId = "town";

// --- Map helpers -----------------------------------------------------
function rowsFromStrings(strRows) {
  const rows = strRows.map((r) => r.split(""));
  for (const r of rows) {
    if (r.length !== MAP_W) {
      console.error("Map row width mismatch:", r.length, "expected", MAP_W);
    }
  }
  return rows;
}

function solidTile(ch, mapId) {
  if (!ch) return true;
  if (ch === "#" || ch === "G" || ch === "H" || ch === "~" || ch === "X")
    return true;
  if (ch === "B") {
    const unlocked =
      npcTalkCount() >= 3 &&
      !gameState.lektillAwakened &&
      mapId === "town";
    return !unlocked;
  }
  return false;
}

function npcTalkCount() {
  let n = 0;
  if (gameState.talkedToMother) n++;
  if (gameState.talkedToTaylor) n++;
  if (gameState.talkedToFarmer) n++;
  if (gameState.talkedToWorshipper) n++;
  return n;
}

// --- Tile maps -------------------------------------------------------
const maps = {
  town: rowsFromStrings([
    "GGGGGGGBBBGGGGGGGGGGGGGGG",
    "G.......S.......G.......G",
    "G.HHH..........FG.......G",
    "G.H.H..........FFF....FFG",
    "G.HHH...........FFF..FFFG",
    "G................FFFFFFFG",
    "G......TTT.......FFFFFFFG",
    "G......T.T.......FFFFFFFG",
    "G......TTT.......FFFFFFFG",
    "G................FFFFFFFG",
    "G.......@........FFFFFFFG",
    "G................FFFFFFFG",
    "G................FFFFFFFG",
    "G................FFFFFFFG",
    "G................FFFFFFFG",
    "G................FFFFFFFG",
    "G.......................G",
    "GGGGGGGGGGGGGGGGGGGGGGGGG",
  ]),

  emergence: rowsFromStrings(
    (() => {
      const er = ["#".repeat(MAP_W)];
      for (let i = 0; i < MAP_H - 2; i++) {
        er.push("#" + ".".repeat(MAP_W - 2) + "#");
      }
      er.push("#".repeat(MAP_W));
      return er;
    })()
  ),

  maze: rowsFromStrings([
    "#########################",
    "#E......................#",
    "#.####.#########.######.#",
    "#.#..#.#......#.#....I#.#",
    "#.#..#.######.#.#.####..#",
    "#.#..#......#...#.#..#..#",
    "#.####.####.#####.#..#..#",
    "#......#..#.....#.#..#..#",
    "####.###..#.###.#.#..#..#",
    "#....#....#.#I#.#....#..#",
    "#.##.#.####.#.#.####.#..#",
    "#.#..#......#.#......#..#",
    "#.#..########.########..#",
    "#.#....................I#",
    "#.######################.",
    "#.......................x",
    "#########################",
    "#########################",
  ]),

  chamber: rowsFromStrings([
    "#########################",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#.......................#",
    "#########################",
  ]),
};

// E = maze entry spawn, x = exit to chamber (lowercase), I = inscription

// --- NPCs & interactables ------------------------------------------
const npcs = {
  town: [
    {
      id: "mother",
      name: "Mother",
      x: 5,
      y: 5,
      w: 1,
      h: 2,
      color: "#6b5a72",
      onTalk() {
        gameState.talkedToMother = true;
        startDialogue("Mother", [
          "The ground shook before sunrise. Stay close to town today.",
          "I keep thinking I hear something breathing under the floorboards.",
        ]);
      },
    },
    {
      id: "taylor",
      name: "Taylor",
      x: 8,
      y: 10,
      w: 1,
      h: 1,
      color: "#5a6b8a",
      onTalk() {
        gameState.talkedToTaylor = true;
        startDialogue("Taylor", [
          "Everyone is looking north. But you look like you already know what is there.",
          "If you go… come back. Promise me.",
        ]);
      },
    },
    {
      id: "farmer",
      name: "Farmer",
      x: 20,
      y: 8,
      w: 2,
      h: 2,
      color: "#6b6044",
      onTalk() {
        gameState.talkedToFarmer = true;
        startDialogue("Farmer", [
          "The soil is wet, but the fields are drying from underneath.",
          "Roots reach down and find nothing but heat. Like something is drinking.",
        ]);
      },
    },
    {
      id: "worshipper",
      name: "Old Worshipper",
      x: 14,
      y: 2,
      w: 1,
      h: 1,
      color: "#4a5548",
      onTalk() {
        gameState.talkedToWorshipper = true;
        startDialogue("Old Worshipper", [
          "Long ago, people found blue-green stones underground. We called them holy.",
          "The shrine remembers what the church forgot.",
        ]);
      },
    },
  ],

  emergence: [
    {
      id: "crowd1",
      name: "Worshipper",
      x: 5,
      y: 14,
      w: 1,
      h: 1,
      color: "#3a3530",
      onTalk() {
        startDialogue("Worshipper", [
          "It is not a beast. It is an answer.",
          "The mud runs like tears from the sky.",
        ]);
      },
    },
    {
      id: "crowd2",
      name: "Worshipper",
      x: 19,
      y: 14,
      w: 1,
      h: 1,
      color: "#353330",
      onTalk() {
        startDialogue("Worshipper", [
          "Do not look directly into the glow. It looks back.",
        ]);
      },
    },
    {
      id: "crowd3",
      name: "Worshipper",
      x: 12,
      y: 15,
      w: 1,
      h: 1,
      color: "#2f2c28",
      onTalk() {
        startDialogue("Worshipper", [
          "We brought torches. As if fire could judge what rises from below.",
        ]);
      },
    },
  ],

  maze: [],

  chamber: [],
};

const inscriptions = {
  maze: [
    {
      id: "ins1",
      gx: 21,
      gy: 3,
      text: "The Fifth Age sleeps beneath all ages.",
    },
    {
      id: "ins2",
      gx: 13,
      gy: 9,
      text: "The orb feeds the judge.",
    },
    {
      id: "ins3",
      gx: 23,
      gy: 13,
      text: "When Lektíll rises, one vessel chooses for all.",
    },
  ],
};

// --- Lektíll trigger zone (emergence map, near top mass) -----------
const lektillZone = {
  mapId: "emergence",
  x: 2 * TILE,
  y: 10 * TILE,
  w: 21 * TILE,
  h: 3 * TILE,
};

const lektillLines = [
  "A pressure enters your mind.",
  "Not words.",
  "Memory.",
  "Judgment.",
  "Seventy-two lives unfold at once.",
  "You remember what you are.",
  "You remember what you made.",
  "Find the Bulbis Lazul.",
  "Bring it below.",
];

let lektillCutsceneActive = false;
let lektillLineIndex = 0;

// --- Bulbis in chamber ----------------------------------------------
const bulbis = {
  mapId: "chamber",
  cx: 12.5 * TILE,
  cy: 8 * TILE,
  r: 18,
};

// --- Objective DOM ---------------------------------------------------
const objectiveEl = document.getElementById("objective-text");

function updateObjectiveText() {
  if (gameState.exitedAfterEnd) {
    objectiveEl.textContent = "—";
    return;
  }
  if (gameState.gameFinished) {
    objectiveEl.textContent = "The first offering has been found.";
    return;
  }
  if (gameState.hasBulbisLazul) {
    objectiveEl.textContent = "The first offering has been found.";
    return;
  }
  if (gameState.missionStarted) {
    objectiveEl.textContent = "Find the Bulbis Lazul underground.";
    return;
  }
  if (currentMapId === "emergence") {
    objectiveEl.textContent = "Approach Lektíll.";
    return;
  }
  if (npcTalkCount() >= 3) {
    objectiveEl.textContent = "Go north to investigate the disturbance.";
    return;
  }
  objectiveEl.textContent = "Talk to the townspeople.";
}

// --- Collision -------------------------------------------------------
function tileAtPixel(px, py) {
  const gx = Math.floor(px / TILE);
  const gy = Math.floor(py / TILE);
  if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) return "#";
  const row = maps[currentMapId][gy];
  return row[gx];
}

function rectHitsSolid(rx, ry, rw, rh) {
  const corners = [
    [rx, ry],
    [rx + rw - 1, ry],
    [rx, ry + rh - 1],
    [rx + rw - 1, ry + rh - 1],
  ];
  for (const [px, py] of corners) {
    const ch = tileAtPixel(px, py);
    if (solidTile(ch, currentMapId)) return true;
  }
  return false;
}

// --- Proximity interact ----------------------------------------------
function playerCenter() {
  return {
    cx: player.x + player.w / 2,
    cy: player.y + player.h / 2,
  };
}

function nearRect(rx, ry, rw, rh, margin) {
  const { cx, cy } = playerCenter();
  return cx >= rx - margin && cx <= rx + rw + margin && cy >= ry - margin && cy <= ry + rh + margin;
}

function getFacingNPC() {
  const list = npcs[currentMapId] || [];
  const margin = 8;
  for (const n of list) {
    const rx = n.x * TILE;
    const ry = n.y * TILE;
    const rw = n.w * TILE;
    const rh = n.h * TILE;
    if (nearRect(rx, ry, rw, rh, margin)) return n;
  }
  return null;
}

function getFacingInscription() {
  const list = inscriptions[currentMapId] || [];
  const margin = 10;
  for (const ins of list) {
    const rx = ins.gx * TILE + 4;
    const ry = ins.gy * TILE + 4;
    const rw = TILE - 8;
    const rh = TILE - 8;
    if (nearRect(rx, ry, rw, rh, margin)) return ins;
  }
  return null;
}

function nearBulbis() {
  if (currentMapId !== "chamber") return false;
  const { cx, cy } = playerCenter();
  const dx = cx - bulbis.cx;
  const dy = cy - bulbis.cy;
  return Math.hypot(dx, dy) < bulbis.r + 28;
}

function inLektillZone() {
  if (currentMapId !== "emergence") return false;
  const { cx, cy } = playerCenter();
  return (
    cx >= lektillZone.x &&
    cx <= lektillZone.x + lektillZone.w &&
    cy >= lektillZone.y &&
    cy <= lektillZone.y + lektillZone.h
  );
}

// --- Global key handling (restart / exit) ----------------------------
function handleGlobalKeys(e) {
  if (gameState.exitedAfterEnd) return;

  if (gameState.gameFinished) {
    if (e.code === "KeyR") {
      e.preventDefault();
      restartGame();
    }
    if (e.code === "Escape") {
      e.preventDefault();
      gameState.exitedAfterEnd = true;
      updateObjectiveText();
    }
  }

  if (dialogueIsOpen() || lektillCutsceneActive) {
    if (e.code === "KeyE" || e.code === "Space") {
      e.preventDefault();
    }
  }
}

function restartGame() {
  Object.assign(gameState, {
    talkedToMother: false,
    talkedToTaylor: false,
    talkedToFarmer: false,
    talkedToWorshipper: false,
    lektillAwakened: false,
    missionStarted: false,
    hasBulbisLazul: false,
    gameFinished: false,
    exitedAfterEnd: false,
  });
  closeDialogue();
  lektillCutsceneActive = false;
  lektillLineIndex = 0;
  currentMapId = "town";
  player.x = 3 * TILE + 6;
  player.y = 8 * TILE + 6;
  interactLatch = false;
  updateObjectiveText();
}

// --- Cutscene: Lektíll ----------------------------------------------
function startLektillCutscene() {
  if (gameState.lektillAwakened) return;
  gameState.lektillAwakened = true;
  lektillCutsceneActive = true;
  lektillLineIndex = 0;
  startDialogue("…", [lektillLines[0]]);
}

function advanceLektillCutscene() {
  lektillLineIndex++;
  if (lektillLineIndex >= lektillLines.length) {
    lektillCutsceneActive = false;
    closeDialogue();
    gameState.missionStarted = true;
    currentMapId = "maze";
    player.x = 2 * TILE + 6;
    player.y = 1 * TILE + 6;
    updateObjectiveText();
    return;
  }
  startDialogue("…", [lektillLines[lektillLineIndex]]);
}

// --- Update --------------------------------------------------------
function update() {
  if (gameState.exitedAfterEnd) return;

  if (gameState.gameFinished) {
    return;
  }

  // Dialogue advance
  if (dialogueIsOpen() && isInteractPressed()) {
    if (!interactLatch) {
      interactLatch = true;
      if (lektillCutsceneActive) {
        advanceLektillCutscene();
      } else {
        advanceDialogue();
      }
    }
    return;
  } else if (!isInteractPressed()) {
    interactLatch = false;
  }

  if (dialogueIsOpen() || lektillCutsceneActive) {
    return;
  }

  // Movement
  let dx = 0;
  let dy = 0;
  if (isUp()) dy -= 1;
  if (isDown()) dy += 1;
  if (isLeft()) dx -= 1;
  if (isRight()) dx += 1;
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  if (dx !== 0 || dy !== 0) {
    const nx = player.x + dx * player.speed;
    const ny = player.y + dy * player.speed;
    let px = player.x;
    let py = player.y;
    if (!rectHitsSolid(nx, py, player.w, player.h)) px = nx;
    if (!rectHitsSolid(px, ny, player.w, player.h)) py = ny;
    player.x = Math.max(0, Math.min(CANVAS_W - player.w, px));
    player.y = Math.max(0, Math.min(CANVAS_H - player.h, py));
  }

  // Town north transition (top edge — only central gate under the BBB tiles)
  const { cx, cy } = playerCenter();
  if (
    currentMapId === "town" &&
    cy < TILE * 2 &&
    cx > 7 * TILE &&
    cx < 10 * TILE
  ) {
    if (npcTalkCount() >= 3) {
      currentMapId = "emergence";
      player.x = 12 * TILE + 6;
      player.y = 15 * TILE + 6;
      updateObjectiveText();
    } else if (!dialogueIsOpen()) {
      startDialogue("…", [
        "Something in the air warns you: listen to the living first.",
      ]);
      player.y = TILE * 2;
    }
  }

  // Maze → chamber (stand on exit tiles bottom-right area)
  if (currentMapId === "maze") {
    const gx = Math.floor((player.x + player.w / 2) / TILE);
    const gy = Math.floor((player.y + player.h / 2) / TILE);
    const row = maps.maze[gy];
    if (row && row[gx] === "x") {
      currentMapId = "chamber";
      player.x = 12 * TILE + 6;
      player.y = 14 * TILE + 6;
    }
  }

  // Interact NPC / inscription / bulbis
  if (isInteractPressed() && !interactLatch) {
    interactLatch = true;

    const npc = getFacingNPC();
    if (npc) {
      npc.onTalk();
      updateObjectiveText();
      return;
    }

    const ins = getFacingInscription();
    if (ins) {
      startDialogue("Inscription", [ins.text]);
      return;
    }

    if (nearBulbis()) {
      gameState.hasBulbisLazul = true;
      gameState.gameFinished = true;
      updateObjectiveText();
      return;
    }
  } else if (!isInteractPressed()) {
    interactLatch = false;
  }

  // Lektíll approach
  if (currentMapId === "emergence" && !gameState.lektillAwakened && inLektillZone()) {
    startLektillCutscene();
    updateObjectiveText();
  }
}

// --- Rendering: tiles ----------------------------------------------
function drawTownTile(gx, gy, ch) {
  const px = gx * TILE;
  const py = gy * TILE;
  if (ch === "G") {
    ctx.fillStyle = C.grass;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#1a2418";
    ctx.fillRect(px + 8, py + 4, 10, 14);
    ctx.fillStyle = "#2a3820";
    ctx.fillRect(px + 4, py + 18, 20, 10);
    return;
  }
  if (ch === "H") {
    ctx.fillStyle = C.soilWet;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = C.wood;
    ctx.fillRect(px + 2, py + 4, TILE - 4, TILE - 6);
    ctx.fillStyle = "#1a1510";
    ctx.fillRect(px + 10, py + 12, 8, 10);
    return;
  }
  if (ch === "F") {
    ctx.fillStyle = C.soil;
    ctx.fillRect(px, py, TILE, TILE);
    if ((gx + gy) % 3 === 0) {
      ctx.fillStyle = C.grassHi;
      ctx.fillRect(px + 6, py + 10, 4, 8);
    }
    return;
  }
  if (ch === "S") {
    ctx.fillStyle = C.soilWet;
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }
  if (ch === "T") {
    ctx.fillStyle = "#2a2824";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = "#3a3530";
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    return;
  }
  if (ch === "B") {
    const open = npcTalkCount() >= 3;
    ctx.fillStyle = open ? C.soilWet : "#151a18";
    ctx.fillRect(px, py, TILE, TILE);
    if (!open) {
      ctx.fillStyle = "#0a0c0b";
      ctx.fillRect(px + 4, py + 6, TILE - 8, TILE - 10);
    }
    return;
  }
  // '.' default ground
  ctx.fillStyle = C.soilWet;
  ctx.fillRect(px, py, TILE, TILE);
  if ((gx * 7 + gy * 13) % 5 === 0) {
    ctx.fillStyle = "rgba(94,230,200,0.04)";
    ctx.fillRect(px + 4, py + 20, 10, 4);
  }
}

function drawEmergenceTile(gx, gy, ch) {
  const px = gx * TILE;
  const py = gy * TILE;
  if (ch === "#") {
    ctx.fillStyle = "#0e1210";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = "#1a2822";
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    return;
  }
  ctx.fillStyle = C.soilWet;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "rgba(94,230,200,0.06)";
  if ((gx + gy * 2) % 4 === 0) {
    ctx.fillRect(px + 6, py + 18, 6, 4);
  }
}

function drawMazeTile(gx, gy, ch) {
  const px = gx * TILE;
  const py = gy * TILE;
  if (ch === "#") {
    ctx.fillStyle = C.stone;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = C.stoneHi;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    return;
  }
  ctx.fillStyle = "#0e1012";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = C.soilWet;
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
  if ((gx + gy) % 2 === 0) {
    ctx.fillStyle = "rgba(94,230,200,0.07)";
    ctx.fillRect(px + 8, py + 14, 10, 6);
  }
  if (ch === "x") {
    ctx.fillStyle = "rgba(94,230,200,0.15)";
    ctx.fillRect(px, py, TILE, TILE);
  }
}

function drawChamberTile(gx, gy, ch) {
  const px = gx * TILE;
  const py = gy * TILE;
  if (ch === "#") {
    ctx.fillStyle = "#050608";
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }
  const g = ctx.createRadialGradient(
    12.5 * TILE,
    8 * TILE,
    20,
    px + TILE / 2,
    py + TILE / 2,
    TILE * 2
  );
  g.addColorStop(0, "rgba(94,230,200,0.12)");
  g.addColorStop(1, "#07090a");
  ctx.fillStyle = g;
  ctx.fillRect(px, py, TILE, TILE);
}

function drawMap() {
  const grid = maps[currentMapId];
  for (let gy = 0; gy < MAP_H; gy++) {
    for (let gx = 0; gx < MAP_W; gx++) {
      const ch = grid[gy][gx];
      if (currentMapId === "town") drawTownTile(gx, gy, ch);
      else if (currentMapId === "emergence") drawEmergenceTile(gx, gy, ch);
      else if (currentMapId === "maze") drawMazeTile(gx, gy, ch);
      else if (currentMapId === "chamber") drawChamberTile(gx, gy, ch);
    }
  }

  // Town: shrine glow
  if (currentMapId === "town") {
    const sx = 8 * TILE;
    const sy = 1 * TILE;
    const rg = ctx.createRadialGradient(
      sx + TILE * 1.5,
      sy + TILE,
      4,
      sx + TILE * 1.5,
      sy + TILE,
      40
    );
    rg.addColorStop(0, "rgba(184,255,240,0.35)");
    rg.addColorStop(0.4, "rgba(94,230,200,0.12)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(sx - 10, sy - 10, TILE * 3 + 20, TILE * 2 + 20);
    ctx.fillStyle = C.stoneHi;
    ctx.fillRect(sx + 8, sy + 6, 40, 30);
    ctx.fillStyle = C.glowDim;
    ctx.beginPath();
    ctx.arc(sx + 28, sy + 20, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Emergence: Lektíll mass + glow dots
  if (currentMapId === "emergence") {
    drawLektillPresence();
  }

  // Maze: inscription markers
  if (currentMapId === "maze") {
    for (const ins of inscriptions.maze) {
      const px = ins.gx * TILE;
      const py = ins.gy * TILE;
      ctx.fillStyle = C.stoneHi;
      ctx.fillRect(px + 6, py + 4, TILE - 12, TILE - 8);
      ctx.fillStyle = "rgba(94,230,200,0.25)";
      ctx.fillRect(px + 10, py + 8, TILE - 20, 6);
    }
  }

  // Chamber: pulsing orb
  if (currentMapId === "chamber" && !gameState.hasBulbisLazul) {
    const pulse = 1 + Math.sin(Date.now() / 220) * 0.12;
    const r = bulbis.r * pulse;
    const g = ctx.createRadialGradient(
      bulbis.cx,
      bulbis.cy,
      2,
      bulbis.cx,
      bulbis.cy,
      r * 3
    );
    g.addColorStop(0, "rgba(184,255,240,0.9)");
    g.addColorStop(0.25, "rgba(94,230,200,0.55)");
    g.addColorStop(0.55, "rgba(40,120,100,0.2)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bulbis.cx, bulbis.cy, r * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(20,40,36,0.85)";
    ctx.beginPath();
    ctx.arc(bulbis.cx, bulbis.cy, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLektillPresence() {
  const t = Date.now() / 1000;
  // Dark body silhouette covering top ~55% of screen
  ctx.save();
  ctx.fillStyle = C.scale;
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_H * 0.52);
  ctx.bezierCurveTo(
    CANVAS_W * 0.15,
    CANVAS_H * 0.08,
    CANVAS_W * 0.35,
    -40,
    CANVAS_W * 0.5,
    20 + Math.sin(t * 1.1) * 6
  );
  ctx.bezierCurveTo(
    CANVAS_W * 0.72,
    -20,
    CANVAS_W * 0.88,
    CANVAS_H * 0.12,
    CANVAS_W,
    CANVAS_H * 0.5
  );
  ctx.lineTo(CANVAS_W, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  // Scale ovals
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % CANVAS_W;
    const sy = 30 + (i * 53) % (CANVAS_H * 0.45);
    ctx.fillStyle = i % 2 === 0 ? C.scaleEdge : "#0a0f0d";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 18, 10, (i * 0.2) % Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Bioluminescent pores
  for (let i = 0; i < 55; i++) {
    const sx = (i * 131) % CANVAS_W;
    const sy = 20 + (i * 79) % (CANVAS_H * 0.42);
    const flicker = 0.5 + 0.5 * Math.sin(t * 3 + i);
    ctx.fillStyle = `rgba(94,230,200,${0.15 + flicker * 0.35})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // Eye suggestion (massive, off-center)
  const ex = CANVAS_W * 0.42 + Math.sin(t * 0.8) * 4;
  const ey = CANVAS_H * 0.2;
  ctx.fillStyle = "#0a0a08";
  ctx.beginPath();
  ctx.ellipse(ex + 60, ey, 70, 45, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(ex + 40, ey, 4, ex + 50, ey, 40);
  g.addColorStop(0, "#c8e6a0");
  g.addColorStop(0.4, "#4a6a40");
  g.addColorStop(1, "#0a1008");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ex + 48, ey, 18, 0, Math.PI * 2);
  ctx.fill();

  // Scattered small orbs in mud
  for (let i = 0; i < 12; i++) {
    const ox = 40 + (i * 63) % (CANVAS_W - 80);
    const oy = CANVAS_H * 0.65 + (i % 4) * 14;
    ctx.fillStyle = "rgba(94,230,200,0.2)";
    ctx.beginPath();
    ctx.arc(ox, oy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawNPC(n) {
  const px = n.x * TILE + (n.w * TILE) / 2;
  const py = n.y * TILE + (n.h * TILE) / 2;
  ctx.fillStyle = n.color;
  ctx.fillRect(px - 8, py - 4, 16, 18);
  ctx.fillStyle = "#c8b8a8";
  ctx.fillRect(px - 6, py - 12, 12, 10);
}

function drawPlayer() {
  const { x, y, w, h } = player;
  ctx.fillStyle = C.playerBody;
  ctx.fillRect(x + 2, y + 10, w - 4, h - 10);
  ctx.fillStyle = C.playerHead;
  ctx.fillRect(x + 4, y + 2, w - 8, 10);
  // subtle outline
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawInteractHint() {
  if (dialogueIsOpen() || gameState.gameFinished) return;
  let label = "";
  if (getFacingNPC()) label = "[E] Talk";
  else if (getFacingInscription()) label = "[E] Read";
  else if (nearBulbis() && currentMapId === "chamber" && !gameState.hasBulbisLazul")
    label = "[E] Take Bulbis Lazul";

  if (!label) return;
  ctx.save();
  ctx.font = "12px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(player.x + player.w / 2 - 52, player.y - 22, 104, 18);
  ctx.fillStyle = C.glow;
  ctx.fillText(label, player.x + player.w / 2, player.y - 8);
  ctx.restore();
}

function drawDialogue() {
  if (!activeDialogue) return;
  const pad = 18;
  const boxH = 110;
  ctx.save();
  ctx.fillStyle = C.uiBg;
  ctx.strokeStyle = C.uiBorder;
  ctx.lineWidth = 1;
  ctx.fillRect(pad, CANVAS_H - boxH - pad, CANVAS_W - pad * 2, boxH);
  ctx.strokeRect(pad + 0.5, CANVAS_H - boxH - pad + 0.5, CANVAS_W - pad * 2 - 1, boxH - 1);

  ctx.fillStyle = C.glowDim;
  ctx.font = "bold 13px Georgia, serif";
  ctx.fillText(activeDialogue.speaker, pad + 14, CANVAS_H - boxH - pad + 26);

  ctx.fillStyle = C.text;
  ctx.font = "15px Georgia, serif";
  const line = activeDialogue.lines[dialogueLineIndex] || "";
  wrapText(
    ctx,
    line,
    pad + 14,
    CANVAS_H - boxH - pad + 52,
    CANVAS_W - pad * 2 - 28,
    20
  );

  ctx.fillStyle = "#5a7068";
  ctx.font = "11px Consolas, monospace";
  ctx.fillText("E / SPACE — continue", CANVAS_W - pad - 160, CANVAS_H - pad - 10);
  ctx.restore();
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  if (!text) return;
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      context.fillText(line, x, yy);
      line = words[n] + " ";
      yy += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, yy);
}

function drawEndingOverlay() {
  if (!gameState.gameFinished) return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = C.text;
  ctx.font = "italic 17px Georgia, serif";
  ctx.textAlign = "center";

  const lines = [
    "You lift the Bulbis Lazul.",
    "It is warm.",
    "Not alive, but remembering life.",
    "Far above, Lektíll waits beneath the torn sky.",
    "The world has not ended yet.",
    "But now the choice belongs to you.",
    "This was only the first offering.",
    "",
    "Press R to restart.",
    "Press Escape to exit.",
  ];

  let y = 70;
  for (const ln of lines) {
    ctx.fillText(ln, CANVAS_W / 2, y);
    y += 26;
  }
  ctx.restore();
}

function drawExitScreen() {
  if (!gameState.exitedAfterEnd) return;
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#8a9a92";
  ctx.font = "18px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(
    "The game has ended. You may now close this window.",
    CANVAS_W / 2,
    CANVAS_H / 2
  );
  ctx.restore();
}

function render() {
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawMap();

  const npcList = npcs[currentMapId] || [];
  for (const n of npcList) drawNPC(n);

  drawPlayer();
  drawInteractHint();
  drawDialogue();
  drawEndingOverlay();
  drawExitScreen();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// --- Boot ------------------------------------------------------------
updateObjectiveText();
requestAnimationFrame(gameLoop);
