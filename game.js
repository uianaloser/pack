// ============================================================
// LOSER PRO MAX - game.js
// Jogo de plataforma 2D feito em Canvas puro, sem bibliotecas.
// ============================================================

(function () {
  "use strict";

  // -----------------------------------------------------------
  // ELEMENTOS DA PÁGINA
  // -----------------------------------------------------------
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const startScreen = document.getElementById("start-screen");
  const hud = document.getElementById("hud");
  const touchControls = document.getElementById("touch-controls");
  const pauseModal = document.getElementById("pause-modal");
  const gameoverModal = document.getElementById("gameover-modal");
  const finalModal = document.getElementById("final-modal");
  const finalFx = document.getElementById("final-fx");
  const toastEl = document.getElementById("toast");
  const rotateHint = document.getElementById("rotate-hint");

  const hudCoins = document.getElementById("hud-coins");
  const hudLetters = document.getElementById("hud-letters");
  const hudLives = document.getElementById("hud-lives");

  const btnPlay = document.getElementById("btn-play");
  const btnPause = document.getElementById("btn-pause");
  const btnResume = document.getElementById("btn-resume");
  const btnRetry = document.getElementById("btn-retry");
  const btnPlayAgain = document.getElementById("btn-play-again");
  const btnSound = document.getElementById("btn-sound");

  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");
  const btnJump = document.getElementById("btn-jump");

  const finalPhotoImg = document.getElementById("final-photo");
  const finalPhotoPlaceholder = document.getElementById("final-photo-placeholder");
  const finalAudio = document.getElementById("final-audio");

  // -----------------------------------------------------------
  // CONSTANTES DO MUNDO / FÍSICA
  // -----------------------------------------------------------
  const BASE_W = 900;
  const BASE_H = 500;
  const GROUND_Y = 430; // topo do chão (parte superior da faixa de chão)
  const WORLD_WIDTH = 5200;

  const GRAVITY = 0.62;
  const MOVE_ACCEL = 0.55;
  const FRICTION = 0.62;
  const MAX_SPEED = 5.2;
  const JUMP_VELOCITY = -12.4;
  const COYOTE_TIME = 110; // ms
  const JUMP_BUFFER = 140; // ms

  const PLAYER_W = 30;
  const PLAYER_H = 46;

  // -----------------------------------------------------------
  // ESTADO GERAL DO JOGO
  // -----------------------------------------------------------
  let state = "start"; // start | playing | paused | gameover | finished
  let soundOn = true;
  let audioCtx = null;

  let lastTime = 0;
  let cameraX = 0;

  // toast (mensagem rápida)
  let toastTimer = 0;

  // -----------------------------------------------------------
  // FASE: CHÃO (com buracos), PLATAFORMAS, CAIXAS
  // -----------------------------------------------------------
  // Cada segmento de chão é um retângulo sólido. Os espaços entre
  // segmentos são os buracos (pits).
  const groundSegments = [
    { x: 0, w: 480 },
    { x: 560, w: 380 },
    { x: 1030, w: 260 },
    { x: 1380, w: 520 },
    { x: 1990, w: 200 },
    { x: 2280, w: 420 },
    { x: 2790, w: 260 },
    { x: 3140, w: 560 },
    { x: 3790, w: 220 },
    { x: 4100, w: 500 },
    { x: 4690, w: 510 },
  ].map(seg => ({ x: seg.x, y: GROUND_Y, w: seg.w, h: BASE_H - GROUND_Y + 100 }));

  const platforms = [
    { x: 300, y: 330, w: 110, h: 22 },
    { x: 470, y: 260, w: 90, h: 22 },
    { x: 640, y: 330, w: 120, h: 22 },
    { x: 900, y: 300, w: 100, h: 22 },
    { x: 1080, y: 350, w: 90, h: 22 },
    { x: 1450, y: 320, w: 100, h: 22 },
    { x: 1610, y: 250, w: 100, h: 22 },
    { x: 1780, y: 320, w: 110, h: 22 },
    { x: 2040, y: 340, w: 100, h: 22 },
    { x: 2320, y: 300, w: 100, h: 22 },
    { x: 2500, y: 240, w: 90, h: 22 },
    { x: 2680, y: 310, w: 90, h: 22 },
    { x: 2900, y: 350, w: 90, h: 22 },
    { x: 3180, y: 290, w: 110, h: 22 },
    { x: 3400, y: 230, w: 100, h: 22 },
    { x: 3600, y: 300, w: 110, h: 22 },
    { x: 3840, y: 350, w: 90, h: 22 },
    { x: 4150, y: 300, w: 110, h: 22 },
    { x: 4350, y: 240, w: 100, h: 22 },
    { x: 4550, y: 320, w: 100, h: 22 },
    { x: 4780, y: 350, w: 130, h: 22 },
  ];

  const boxes = [
    { x: 700, y: 394, w: 36, h: 36 },
    { x: 1200, y: 394, w: 36, h: 36 },
    { x: 1240, y: 394, w: 36, h: 36 },
    { x: 2350, y: 394, w: 36, h: 36 },
    { x: 3250, y: 394, w: 36, h: 36 },
    { x: 3290, y: 394, w: 36, h: 36 },
    { x: 4200, y: 394, w: 36, h: 36 },
  ];

  const allSolids = () => [
    ...groundSegments.map(g => ({ x: g.x, y: g.y, w: g.w, h: g.h })),
    ...platforms,
    ...boxes,
  ];

  // -----------------------------------------------------------
  // MOEDAS
  // -----------------------------------------------------------
  function buildCoins() {
    const coinXs = [
      340, 380, 500, 690, 730, 920, 950, 1100, 1420, 1460,
      1630, 1660, 1800, 1830, 2060, 2320, 2360, 2520, 2700,
      2920, 3200, 3230, 3420, 3620, 3650, 3860, 4170, 4370,
      4400, 4570, 4800, 4830,
    ];
    return coinXs.map((x, i) => ({
      id: "coin" + i,
      x,
      y: findYAbove(x) - 40,
      r: 11,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  // Acha uma altura razoável acima do chão/plataforma mais próxima em x
  function findYAbove(x) {
    let best = GROUND_Y;
    for (const p of platforms) {
      if (x >= p.x - 10 && x <= p.x + p.w + 10 && p.y < best) best = p.y;
    }
    for (const g of groundSegments) {
      if (x >= g.x && x <= g.x + g.w) {
        if (GROUND_Y < best) best = GROUND_Y;
      }
    }
    return best;
  }

  let coins = buildCoins();

  // -----------------------------------------------------------
  // LETRAS COLETÁVEIS (formam LOSER)
  // -----------------------------------------------------------
  const LETTER_SEQUENCE = ["L", "O", "S", "E", "R"];
  function buildLetters() {
    const positions = [
      { x: 420, y: 200 },
      { x: 1260, y: 190 },
      { x: 2270, y: 160 },
      { x: 3260, y: 150 },
      { x: 4560, y: 160 },
    ];
    return LETTER_SEQUENCE.map((ch, i) => ({
      letter: ch,
      x: positions[i].x,
      y: positions[i].y,
      w: 34,
      h: 34,
      collected: false,
      pulse: Math.random() * Math.PI * 2,
    }));
  }
  let letters = buildLetters();

  // -----------------------------------------------------------
  // CHEGADA (bandeira)
  // -----------------------------------------------------------
  const flag = { x: 5050, y: GROUND_Y - 160, w: 20, h: 160, touchedRecently: false };

  // -----------------------------------------------------------
  // JOGADOR
  // -----------------------------------------------------------
  function freshPlayer() {
    return {
      x: 60,
      y: GROUND_Y - PLAYER_H,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: 1, // 1 direita, -1 esquerda
      runFrame: 0,
      lastGroundTime: 0,
      lastJumpPressTime: -9999,
      checkpointX: 60,
      checkpointY: GROUND_Y - PLAYER_H,
      celebrating: false,
    };
  }
  let player = freshPlayer();

  let lives = 3;
  let coinsCollected = 0;
  let lettersCollectedFlags = [false, false, false, false, false];

  // -----------------------------------------------------------
  // INPUT
  // -----------------------------------------------------------
  const input = { left: false, right: false, jumpHeld: false, jumpPressedAt: -9999 };

  function pressJump() {
    input.jumpPressedAt = performance.now();
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "KeyA"].includes(e.code)) input.left = true;
    if (["ArrowRight", "KeyD"].includes(e.code)) input.right = true;
    if (["ArrowUp", "KeyW", "Space"].includes(e.code)) {
      if (!input.jumpHeld) pressJump();
      input.jumpHeld = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (["ArrowLeft", "KeyA"].includes(e.code)) input.left = false;
    if (["ArrowRight", "KeyD"].includes(e.code)) input.right = false;
    if (["ArrowUp", "KeyW", "Space"].includes(e.code)) input.jumpHeld = false;
  });

  function bindTouchButton(el, onDown, onUp) {
    const down = (e) => { e.preventDefault(); onDown(); };
    const up = (e) => { e.preventDefault(); onUp(); };
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("touchcancel", up, { passive: false });
    // também funciona com mouse (para testes em desktop)
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("mouseleave", up);
  }

  bindTouchButton(btnLeft, () => (input.left = true), () => (input.left = false));
  bindTouchButton(btnRight, () => (input.right = true), () => (input.right = false));
  bindTouchButton(
    btnJump,
    () => { input.jumpHeld = true; pressJump(); },
    () => (input.jumpHeld = false)
  );

  // -----------------------------------------------------------
  // ÁUDIO (Web Audio API, sem arquivos externos)
  // -----------------------------------------------------------
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playTone(freq, duration, type, volume, delay) {
    if (!soundOn || !audioCtx) return;
    const t0 = audioCtx.currentTime + (delay || 0);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(volume || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const sound = {
    jump: () => playTone(520, 0.15, "square", 0.15),
    coin: () => { playTone(880, 0.08, "square", 0.15); playTone(1320, 0.09, "square", 0.12, 0.06); },
    letter: () => { playTone(660, 0.12, "sawtooth", 0.15); playTone(990, 0.14, "sawtooth", 0.15, 0.08); playTone(1320, 0.16, "sawtooth", 0.15, 0.16); },
    fall: () => playTone(180, 0.3, "sawtooth", 0.2),
    finish: () => { [523, 659, 784, 1046].forEach((f, i) => playTone(f, 0.22, "square", 0.18, i * 0.12)); },
  };

  btnSound.addEventListener("click", () => {
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? "🔊" : "🔇";
  });

  // -----------------------------------------------------------
  // COLISÃO AABB
  // -----------------------------------------------------------
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function resolveHorizontal(p, solids) {
    for (const s of solids) {
      if (rectsOverlap(p, s)) {
        if (p.vx > 0) p.x = s.x - p.w;
        else if (p.vx < 0) p.x = s.x + s.w;
        p.vx = 0;
      }
    }
  }

  function resolveVertical(p, solids) {
    p.onGround = false;
    for (const s of solids) {
      if (rectsOverlap(p, s)) {
        if (p.vy > 0) {
          p.y = s.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (p.vy < 0) {
          p.y = s.y + s.h;
          p.vy = 0;
        }
      }
    }
  }

  // -----------------------------------------------------------
  // TOAST
  // -----------------------------------------------------------
  function showToast(msg, duration) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    toastTimer = duration || 2200;
  }

  // -----------------------------------------------------------
  // ATUALIZAÇÃO DO HUD
  // -----------------------------------------------------------
  function updateHud() {
    hudCoins.textContent = "MOEDAS: " + String(coinsCollected).padStart(2, "0");
    const shown = LETTER_SEQUENCE.map((ch, i) => (lettersCollectedFlags[i] ? ch : "_")).join(" ");
    hudLetters.textContent = "LETRAS: " + shown;
    hudLives.textContent = "VIDAS: " + lives;
  }

  // -----------------------------------------------------------
  // RESET / REINÍCIO COMPLETO
  // -----------------------------------------------------------
  function resetGame() {
    player = freshPlayer();
    lives = 3;
    coinsCollected = 0;
    lettersCollectedFlags = [false, false, false, false, false];
    coins = buildCoins();
    letters = buildLetters();
    cameraX = 0;
    updateHud();
  }

  // -----------------------------------------------------------
  // QUEDA EM BURACO
  // -----------------------------------------------------------
  let flashTimer = 0;
  function fallIntoPit() {
    sound.fall();
    lives -= 1;
    flashTimer = 220;
    updateHud();
    if (lives <= 0) {
      state = "gameover";
      gameoverModal.classList.remove("hidden");
      return;
    }
    player.x = player.checkpointX;
    player.y = player.checkpointY;
    player.vx = 0;
    player.vy = 0;
  }

  // -----------------------------------------------------------
  // LOOP PRINCIPAL
  // -----------------------------------------------------------
  function update(dt, now) {
    if (state !== "playing") return;

    // --- movimento horizontal ---
    if (input.left && !input.right) {
      player.vx -= MOVE_ACCEL;
      player.facing = -1;
    } else if (input.right && !input.left) {
      player.vx += MOVE_ACCEL;
      player.facing = 1;
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }
    player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));

    // --- coyote time + jump buffer ---
    if (player.onGround) player.lastGroundTime = now;
    const withinCoyote = now - player.lastGroundTime <= COYOTE_TIME;
    const withinBuffer = now - input.jumpPressedAt <= JUMP_BUFFER;

    if (withinBuffer && withinCoyote) {
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
      player.lastGroundTime = -9999;
      input.jumpPressedAt = -9999;
      sound.jump();
    }

    // --- gravidade ---
    player.vy += GRAVITY;
    if (player.vy > 18) player.vy = 18;

    // --- resolve X ---
    player.x += player.vx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > WORLD_WIDTH) player.x = WORLD_WIDTH - player.w;
    resolveHorizontal(player, allSolids());

    // --- resolve Y ---
    player.y += player.vy;
    resolveVertical(player, allSolids());

    // --- checkpoint (última posição segura) ---
    if (player.onGround) {
      player.checkpointX = player.x;
      player.checkpointY = player.y;
    }

    // --- queda em buraco ---
    if (player.y > BASE_H + 60) {
      fallIntoPit();
    }

    // --- animação de corrida ---
    if (Math.abs(player.vx) > 0.3 && player.onGround) {
      player.runFrame += dt * 0.012;
    }

    // --- câmera ---
    cameraX = player.x + player.w / 2 - BASE_W / 2;
    cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - BASE_W));

    // --- coleta de moedas ---
    for (const c of coins) {
      if (c.collected) continue;
      c.pulse += dt * 0.006;
      const dx = (player.x + player.w / 2) - c.x;
      const dy = (player.y + player.h / 2) - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < c.r + 18) {
        c.collected = true;
        coinsCollected++;
        sound.coin();
        updateHud();
      }
    }

    // --- coleta de letras ---
    letters.forEach((L, i) => {
      if (L.collected) return;
      L.pulse += dt * 0.005;
      const box = { x: L.x - L.w / 2, y: L.y - L.h / 2, w: L.w, h: L.h };
      if (rectsOverlap(player, box)) {
        L.collected = true;
        lettersCollectedFlags[i] = true;
        sound.letter();
        updateHud();
      }
    });

    // --- chegada / flag ---
    const flagBox = { x: flag.x, y: flag.y, w: flag.w, h: flag.h };
    if (rectsOverlap(player, flagBox)) {
      const allLetters = lettersCollectedFlags.every(Boolean);
      if (allLetters) {
        triggerWin();
      } else if (!flag.touchedRecently) {
        showToast("Você ainda não encontrou todas as letras!");
        flag.touchedRecently = true;
      }
    } else {
      flag.touchedRecently = false;
    }

    // --- toast timer ---
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.add("hidden");
    }

    // --- flash de queda ---
    if (flashTimer > 0) flashTimer -= dt;
  }

  // -----------------------------------------------------------
  // VITÓRIA
  // -----------------------------------------------------------
  function triggerWin() {
    if (state !== "playing") return;
    state = "finished";
    player.celebrating = true;
    input.left = false;
    input.right = false;
    input.jumpHeld = false;
    sound.finish();
    setTimeout(() => {
      finalModal.classList.remove("hidden");
      spawnBalloonsAndConfetti();
      playFinalAudio();
    }, 900);
  }

  // -----------------------------------------------------------
  // DESENHO
  // -----------------------------------------------------------
  function drawBackground() {
    // céu (gradiente já é o fundo do canvas via CSS, aqui desenhamos nuvens/montanhas)
    ctx.fillStyle = "#7ec8e3";
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // montanhas distantes (parallax leve)
    ctx.fillStyle = "#5aa7c9";
    const mParallax = cameraX * 0.2;
    for (let i = -1; i < 8; i++) {
      const mx = i * 260 - (mParallax % 260);
      ctx.beginPath();
      ctx.moveTo(mx, BASE_H - 170);
      ctx.lineTo(mx + 130, BASE_H - 280);
      ctx.lineTo(mx + 260, BASE_H - 170);
      ctx.closePath();
      ctx.fill();
    }

    // nuvens
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    const cParallax = cameraX * 0.4;
    for (let i = -1; i < 10; i++) {
      const cx = i * 300 - (cParallax % 300);
      const cy = 70 + (i % 3) * 40;
      drawCloud(cx, cy);
    }

    // cidadezinha original bem distante
    ctx.fillStyle = "rgba(70,90,120,0.5)";
    const bParallax = cameraX * 0.1;
    for (let i = -1; i < 12; i++) {
      const bx = i * 150 - (bParallax % 150);
      const bh = 40 + (i % 4) * 18;
      ctx.fillRect(bx, BASE_H - 200 - bh, 46, bh + 200);
    }
  }

  function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.arc(x + 20, y - 8, 22, 0, Math.PI * 2);
    ctx.arc(x + 42, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);

    // chão
    for (const g of groundSegments) {
      const grad = ctx.createLinearGradient(0, g.y, 0, g.y + 40);
      grad.addColorStop(0, "#6fcf5a");
      grad.addColorStop(1, "#8b5a2b");
      ctx.fillStyle = grad;
      ctx.fillRect(g.x, g.y, g.w, BASE_H - g.y + 100);
      ctx.fillStyle = "#4fae3d";
      ctx.fillRect(g.x, g.y, g.w, 10);
    }

    // plataformas
    for (const p of platforms) {
      ctx.fillStyle = "#c97b3d";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#e8a35c";
      ctx.fillRect(p.x, p.y, p.w, 6);
    }

    // caixas
    for (const b of boxes) {
      ctx.fillStyle = "#d1913c";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "#8a5a1e";
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    }

    // moedas
    for (const c of coins) {
      if (c.collected) continue;
      const scale = 0.8 + Math.sin(c.pulse) * 0.2;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(scale, 1);
      ctx.beginPath();
      ctx.arc(0, 0, c.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd700";
      ctx.fill();
      ctx.strokeStyle = "#b8860b";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // letras
    for (const L of letters) {
      if (L.collected) continue;
      const floatY = Math.sin(L.pulse) * 6;
      ctx.save();
      ctx.translate(L.x, L.y + floatY);
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#ff3d7f";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#fff0f6";
      ctx.fillText(L.letter, 0, 0);
      ctx.restore();
    }

    // bandeira / chegada
    ctx.fillStyle = "#8a5a1e";
    ctx.fillRect(flag.x, flag.y, 6, flag.h);
    ctx.fillStyle = "#ff5e5e";
    ctx.beginPath();
    ctx.moveTo(flag.x + 6, flag.y + 6);
    ctx.lineTo(flag.x + 46, flag.y + 20);
    ctx.lineTo(flag.x + 6, flag.y + 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FIM", flag.x + 3, flag.y - 8);

    drawPlayer();

    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.scale(p.facing, 1);

    const bounce = p.onGround ? Math.sin(p.runFrame) * 3 : 0;
    const legSwing = p.onGround && Math.abs(p.vx) > 0.3 ? Math.sin(p.runFrame * 2) * 10 : 0;

    // pernas
    ctx.fillStyle = "#3a2b6d";
    ctx.fillRect(-9, 14 + bounce * 0.2, 7, 10 - legSwing * 0.15);
    ctx.fillRect(2, 14 + bounce * 0.2, 7, 10 + legSwing * 0.15);

    // corpo (roupa colorida)
    ctx.fillStyle = "#ff6fa5";
    ctx.beginPath();
    ctx.roundRect(-11, -6 + bounce * 0.3, 22, 24, 8);
    ctx.fill();

    // cabeça grande
    ctx.fillStyle = "#ffd8b0";
    ctx.beginPath();
    ctx.arc(0, -20 + bounce * 0.3, 15, 0, Math.PI * 2);
    ctx.fill();

    // cabelo
    ctx.fillStyle = "#7b3fa0";
    ctx.beginPath();
    ctx.arc(0, -27 + bounce * 0.3, 14, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-14, -30 + bounce * 0.3, 6, 14);
    ctx.fillRect(8, -30 + bounce * 0.3, 6, 14);

    // olho + expressão engraçada
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(6, -20 + bounce * 0.3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#a35b3a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(5, -14 + bounce * 0.3, 4, 0, Math.PI, false);
    ctx.stroke();

    // bochecha
    ctx.fillStyle = "rgba(255,120,140,0.55)";
    ctx.beginPath();
    ctx.arc(-2, -16 + bounce * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawFlash() {
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(255,0,0,${(flashTimer / 220) * 0.35})`;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }
  }

  function render() {
    drawBackground();
    drawWorld();
    drawFlash();
  }

  // -----------------------------------------------------------
  // LOOP (requestAnimationFrame)
  // -----------------------------------------------------------
  function loop(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(now - lastTime, 40); // limita saltos grandes de tempo
    lastTime = now;

    update(dt, now);
    render();

    requestAnimationFrame(loop);
  }

  // -----------------------------------------------------------
  // BOTÕES DE INTERFACE
  // -----------------------------------------------------------
  btnPlay.addEventListener("click", () => {
    ensureAudio();
    startScreen.classList.add("hidden");
    hud.classList.remove("hidden");
    touchControls.classList.remove("hidden");
    resetGame();
    state = "playing";
  });

  btnPause.addEventListener("click", () => {
    if (state === "playing") {
      state = "paused";
      pauseModal.classList.remove("hidden");
    }
  });

  btnResume.addEventListener("click", () => {
    pauseModal.classList.add("hidden");
    state = "playing";
  });

  btnRetry.addEventListener("click", () => {
    gameoverModal.classList.add("hidden");
    resetGame();
    state = "playing";
  });

  btnPlayAgain.addEventListener("click", () => {
    finalModal.classList.add("hidden");
    finalFx.innerHTML = "";
    if (finalAudio) {
      finalAudio.pause();
      finalAudio.currentTime = 0;
    }
    resetGame();
    state = "playing";
  });

  // -----------------------------------------------------------
  // FOTO FINAL (com fallback se a imagem não existir)
  // -----------------------------------------------------------
  finalPhotoImg.addEventListener("error", () => {
    finalPhotoImg.style.display = "none";
    finalPhotoPlaceholder.style.display = "flex";
  });
  finalPhotoImg.addEventListener("load", () => {
    finalPhotoPlaceholder.style.display = "none";
  });
  // Corrige o caso em que a imagem já carregou (ex: veio do cache) antes
  // dos listeners acima serem registrados, o que faria o evento "load"
  // passar despercebido e o placeholder ficar preso por cima da foto.
  if (finalPhotoImg.complete) {
    if (finalPhotoImg.naturalWidth > 0) {
      finalPhotoPlaceholder.style.display = "none";
    } else {
      finalPhotoImg.style.display = "none";
      finalPhotoPlaceholder.style.display = "flex";
    }
  }

  // -----------------------------------------------------------
  // ÁUDIO DA TELA FINAL
  // -----------------------------------------------------------
  function playFinalAudio() {
    if (!soundOn || !finalAudio) return;
    finalAudio.currentTime = 0;
    finalAudio.volume = 0.8;
    const playPromise = finalAudio.play();
    if (playPromise && playPromise.catch) {
      // Se o arquivo não existir ou o navegador bloquear, falha em silêncio
      playPromise.catch(() => {});
    }
  }

  // -----------------------------------------------------------
  // BALÕES E CONFETES NA TELA FINAL
  // -----------------------------------------------------------
  function spawnBalloonsAndConfetti() {
    const balloonColors = ["#ff6fa5", "#ffd93d", "#5cd6ff", "#7bed9f", "#ff9f43"];
    const confettiColors = ["#ff5e5e", "#ffd93d", "#5cd6ff", "#7bed9f", "#c56cf0"];

    const totalBalloons = 12;
    for (let i = 0; i < totalBalloons; i++) {
      const b = document.createElement("div");
      b.className = "balloon";
      const size = 28 + Math.random() * 26;
      b.style.width = size + "px";
      b.style.height = size * 1.2 + "px";
      b.style.left = Math.random() * 92 + "%";
      b.style.background = balloonColors[i % balloonColors.length];
      const duration = 5 + Math.random() * 5;
      b.style.animationDuration = duration + "s";
      b.style.animationDelay = (Math.random() * 3) + "s";
      finalFx.appendChild(b);
    }

    const totalConfetti = 26;
    for (let i = 0; i < totalConfetti; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      const size = 6 + Math.random() * 6;
      c.style.width = size + "px";
      c.style.height = size + "px";
      c.style.left = Math.random() * 96 + "%";
      c.style.background = confettiColors[i % confettiColors.length];
      const duration = 3 + Math.random() * 3;
      c.style.animationDuration = duration + "s";
      c.style.animationDelay = (Math.random() * 2) + "s";
      finalFx.appendChild(c);
    }
  }

  // -----------------------------------------------------------
  // RESPONSIVIDADE / ORIENTAÇÃO
  // -----------------------------------------------------------
  function handleResize() {
    // O canvas usa resolução lógica fixa (900x500) e é escalado via CSS,
    // então as coordenadas do jogo não mudam - apenas o tamanho visual.
    const isPortraitSmall = window.innerHeight > window.innerWidth && window.innerWidth < 520;
    if (isPortraitSmall) {
      rotateHint.classList.remove("hidden");
    } else {
      rotateHint.classList.add("hidden");
    }
  }
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);
  handleResize();

  // evita gestos de zoom por pinça / duplo toque
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // -----------------------------------------------------------
  // INICIALIZAÇÃO
  // -----------------------------------------------------------
  updateHud();
  requestAnimationFrame(loop);
})();
