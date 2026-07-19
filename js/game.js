/* ============================================================
   UIANA LOSER PRO MAX — game.js
   Motor do jogo. Modelo de sincronização "anfitrião autoritativo":
   o jogador que CRIOU a sala roda a lógica (dado, eventos, turnos)
   e escreve o estado em /rooms/{code} no Firebase Realtime Database.
   Os demais jogadores só leem esse estado em tempo real e enviam
   "intenções" (ex: "eu toquei no dado") que o anfitrião processa.
   Isso evita que qualquer participante altere o próprio resultado.
   ============================================================ */

const AVATARS = [
  { id: 'aventureiro', emoji: '🧭' },
  { id: 'exploradora', emoji: '🗺️' },
  { id: 'cavaleiro', emoji: '🛡️' },
  { id: 'feiticeira', emoji: '🔮' },
  { id: 'pirata', emoji: '🏴‍☠️' },
  { id: 'ninja', emoji: '🥷' },
  { id: 'robo', emoji: '🤖' },
  { id: 'alienigena', emoji: '👽' },
];

const COLORS = [
  { id: 'vermelho', hex: '#E63946' },
  { id: 'azul', hex: '#48CAE4' },
  { id: 'amarelo', hex: '#FFD60A' },
  { id: 'verde', hex: '#52B788' },
];

const TURN_SECONDS = 30;
const MAX_CHAIN = 3;

let myUid = null;
let myName = '';
let myAvatar = AVATARS[0].id;
let myColor = COLORS[0].id;
let roomCode = null;
let isHost = false;
let roomRef = null;
let roomState = null; // último snapshot conhecido da sala
let boardCells = null; // layout gerado a partir da seed
let turnTimerInterval = null;
let hostWatchdogInterval = null;
let animating = false;

// ---------- Helpers de UI ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

function genRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += letters[Math.floor(Math.random() * letters.length)];
  return code;
}

// ---------- Autenticação anônima ----------
function ensureAuth() {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(user => {
      if (user) { myUid = user.uid; resolve(user.uid); }
    });
    auth.signInAnonymously().catch(reject);
  });
}

/* ============================================================
   TELA INICIAL
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  showScreen('screen-start');
  buildPickers();

  $('#btn-create').addEventListener('click', () => { SoundSystem.unlock(); SoundSystem.play('click'); openSetup('create'); });
  $('#btn-join').addEventListener('click', () => { SoundSystem.unlock(); SoundSystem.play('click'); openSetup('join'); });
  $('#btn-how').addEventListener('click', () => { SoundSystem.unlock(); SoundSystem.play('click'); showScreen('screen-tutorial'); });
  $('#btn-tutorial-back').addEventListener('click', () => showScreen('screen-start'));
  $('#btn-sound').addEventListener('click', toggleSoundBtn);

  $('#btn-setup-back').addEventListener('click', () => showScreen('screen-start'));
  $('#btn-setup-confirm').addEventListener('click', confirmSetup);

  $('#btn-start-match').addEventListener('click', hostStartMatch);
  $('#btn-leave-room').addEventListener('click', leaveRoom);

  $('#btn-dice').addEventListener('click', onDiceTap);

  $('#btn-play-again').addEventListener('click', hostReturnToWaitingRoom);
  $('#btn-new-room').addEventListener('click', () => location.reload());
  $('#btn-back-home').addEventListener('click', () => location.reload());
  $('#btn-toggle-panel').addEventListener('click', () => {
    $('#panel-ranking').style.display = $('#panel-ranking').style.display === 'none' ? 'block' : 'none';
  });

  ensureAuth().catch(() => toast('Não foi possível conectar. Verifique sua internet.'));
});

function toggleSoundBtn() {
  const on = SoundSystem.toggle();
  $('#btn-sound').textContent = on ? '🔊' : '🔇';
  SoundSystem.play('click');
}

function buildPickers() {
  const avatarWrap = $('#avatar-picker');
  const colorWrap = $('#color-picker');
  avatarWrap.innerHTML = AVATARS.map(a =>
    `<button type="button" class="pick-avatar" data-id="${a.id}">${a.emoji}</button>`).join('');
  colorWrap.innerHTML = COLORS.map(c =>
    `<button type="button" class="pick-color" data-id="${c.id}" style="background:${c.hex}"></button>`).join('');

  avatarWrap.addEventListener('click', e => {
    const btn = e.target.closest('.pick-avatar');
    if (!btn) return;
    $$('.pick-avatar').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    myAvatar = btn.dataset.id;
  });
  colorWrap.addEventListener('click', e => {
    const btn = e.target.closest('.pick-color');
    if (!btn) return;
    $$('.pick-color').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    myColor = btn.dataset.id;
  });
  avatarWrap.firstElementChild.classList.add('selected');
  colorWrap.firstElementChild.classList.add('selected');
}

/* ============================================================
   SETUP (criar / entrar) — nome, avatar, cor, código
   ============================================================ */
let setupMode = 'create';

function openSetup(mode) {
  setupMode = mode;
  $('#setup-title').textContent = mode === 'create' ? 'Criar sala' : 'Entrar em uma sala';
  $('#code-field').style.display = mode === 'join' ? 'block' : 'none';
  $('#room-code-input').value = '';
  $('#player-name-input').value = '';
  showScreen('screen-setup');
}

async function confirmSetup() {
  const name = $('#player-name-input').value.trim().slice(0, 16);
  if (!name) { toast('Digite seu nome!'); return; }
  myName = name;
  $('#btn-setup-confirm').disabled = true;
  try {
    await ensureAuth();
    if (setupMode === 'create') {
      await createRoom();
    } else {
      const code = $('#room-code-input').value.trim().toUpperCase();
      if (code.length < 4) { toast('Digite o código da sala!'); $('#btn-setup-confirm').disabled = false; return; }
      await joinRoom(code);
    }
  } catch (err) {
    console.error(err);
    toast(err.message || 'Algo deu errado. Tente novamente.');
  } finally {
    $('#btn-setup-confirm').disabled = false;
  }
}

async function createRoom() {
  roomCode = genRoomCode();
  isHost = true;
  const seed = Math.floor(Math.random() * 2 ** 31);
  const player = makePlayerObj(true);

  await db.ref(`rooms/${roomCode}`).set({
    hostUid: myUid,
    status: 'waiting',
    seed,
    createdAt: Date.now(),
    players: { [myUid]: player },
  });

  attachRoomListeners();
  setupPresence();
}

async function joinRoom(code) {
  const snap = await db.ref(`rooms/${code}`).get();
  if (!snap.exists()) throw new Error('Essa sala não existe. Confira o código.');
  const room = snap.val();
  if (room.status !== 'waiting') throw new Error('Essa partida já começou ou terminou.');
  const players = room.players || {};
  const count = Object.keys(players).length;
  if (count >= 4) throw new Error('Sala cheia! Máximo de 4 losers por partida.');

  // impedir combinação boneco+cor repetida
  const taken = Object.values(players).some(p => p.avatar === myAvatar && p.color === myColor);
  if (taken) throw new Error('Essa combinação de boneco e cor já foi escolhida. Troque uma delas.');

  roomCode = code;
  isHost = false;
  const player = makePlayerObj(false);
  await db.ref(`rooms/${code}/players/${myUid}`).set(player);

  attachRoomListeners();
  setupPresence();
}

function makePlayerObj(host) {
  return {
    name: myName, avatar: myAvatar, color: myColor,
    isHost: host, connected: true, position: 1,
    skipRounds: 0, shield: false, extraLife: false,
    finished: false, finishRank: null, joinedAt: Date.now(),
  };
}

function setupPresence() {
  const meRef = db.ref(`rooms/${roomCode}/players/${myUid}`);
  meRef.child('connected').onDisconnect().set(false);
  // se o anfitrião cair, marcamos isso pra sala inteira saber
  if (isHost) {
    db.ref(`rooms/${roomCode}/hostConnected`).onDisconnect().set(false);
    db.ref(`rooms/${roomCode}/hostConnected`).set(true);
  }
}

/* ============================================================
   LISTENERS DA SALA (todo mundo escuta o mesmo caminho)
   ============================================================ */
function attachRoomListeners() {
  roomRef = db.ref(`rooms/${roomCode}`);
  roomRef.on('value', snap => {
    const room = snap.val();
    if (!room) { toast('A sala foi encerrada.'); location.reload(); return; }
    const prevStatus = roomState ? roomState.status : null;
    const seedChanged = roomState && roomState.seed !== room.seed;
    roomState = room;
    if (!boardCells || seedChanged) boardCells = generateBoard(room.seed);

    renderByStatus(room, prevStatus);
  });
}

function renderByStatus(room, prevStatus) {
  if (room.status === 'waiting') {
    renderWaitingRoom(room);
    if (document.querySelector('.screen.active')?.id !== 'screen-waiting') showScreen('screen-waiting');
  } else if (room.status === 'ordering') {
    if (prevStatus !== 'ordering') runOrderRoulette(room);
  } else if (room.status === 'playing') {
    if (document.querySelector('.screen.active')?.id !== 'screen-board') { showScreen('screen-board'); buildBoardDOM(); }
    renderBoard(room);
  } else if (room.status === 'finished') {
    showScreen('screen-final');
    renderFinalScreen(room);
  }
}

/* ============================================================
   SALA DE ESPERA
   ============================================================ */
function renderWaitingRoom(room) {
  $('#waiting-code').textContent = roomCode;
  const players = room.players || {};
  const list = Object.entries(players);
  const wrap = $('#waiting-players');
  wrap.innerHTML = list.map(([uid, p]) => `
    <div class="waiting-card">
      <div class="waiting-avatar" style="background:${colorHex(p.color)}">${avatarEmoji(p.avatar)}</div>
      <div class="waiting-info">
        <strong>${escapeHtml(p.name)}</strong>
        ${p.isHost ? '<span class="badge-host">Anfitrião</span>' : ''}
        <span class="status ${p.connected ? 'ok' : 'off'}">${p.connected ? 'Conectado' : 'Desconectado'}</span>
      </div>
    </div>`).join('');

  $('#waiting-msg').textContent = list.length < 2
    ? 'Esperando os outros losers entrarem...'
    : 'Prontos pra descobrir quem vai ser o loser?';

  const amHost = players[myUid]?.isHost;
  $('#btn-start-match').style.display = amHost ? 'block' : 'none';
  $('#btn-start-match').disabled = list.length < 2;
  $('#waiting-hint').style.display = amHost ? 'none' : 'block';
}

async function hostStartMatch() {
  if (!isHost) return;
  const players = roomState.players || {};
  if (Object.keys(players).length < 2) return;
  SoundSystem.play('click');
  await roomRef.child('status').set('ordering');
}

/* ============================================================
   ROLETA DE ORDEM
   ============================================================ */
async function runOrderRoulette(room) {
  showScreen('screen-roulette');
  const players = room.players || {};
  const uids = Object.keys(players);

  // Apenas o anfitrião SORTEIA a ordem e grava — todo mundo apenas assiste a animação local.
  let order = uids;
  if (isHost) {
    order = [...uids].sort(() => Math.random() - 0.5);
  }

  const wrap = $('#roulette-names');
  wrap.innerHTML = uids.map(uid => `<div class="roulette-chip" id="rc-${uid}">${escapeHtml(players[uid].name)}</div>`).join('');
  $('#roulette-result').innerHTML = '';
  $('#roulette-status').textContent = 'Girando...';

  SoundSystem.play('countdown');
  let spins = 0;
  const spinInterval = setInterval(() => {
    $$('.roulette-chip').forEach(c => c.classList.remove('highlight'));
    const rndChip = wrap.children[Math.floor(Math.random() * wrap.children.length)];
    rndChip?.classList.add('highlight');
    SoundSystem.play('roulette');
    spins++;
    if (spins > 18) clearInterval(spinInterval);
  }, 110);

  await sleep(2200);
  clearInterval(spinInterval);

  if (isHost) {
    // grava ordem final e inicia estado de jogo
    const playersUpdate = {};
    order.forEach((uid, i) => { playersUpdate[`players/${uid}/position`] = 1; });
    await roomRef.update({
      order,
      currentTurnIndex: 0,
      status: 'playing',
      chainCount: 0,
      phase: 'idle',
      log: '🌲 A aventura começou! Boa sorte, losers.',
      turnStartedAt: Date.now(),
    });
  }

  // Revelação visual (todos os clientes fazem a mesma animação assim que o `order`
  // chega via listener; aqui mostramos com o array local para feedback imediato)
  const finalOrder = room.order || order;
  $('#roulette-status').textContent = 'Ordem definida!';
  let html = '';
  for (let i = 0; i < finalOrder.length; i++) {
    const p = players[finalOrder[i]];
    await sleep(350);
    SoundSystem.play('reveal');
    html += `<div class="roulette-place">${i + 1}º — ${avatarEmoji(p.avatar)} ${escapeHtml(p.name)}</div>`;
    $('#roulette-result').innerHTML = html;
  }
}

/* ============================================================
   TABULEIRO — construção do DOM (serpentina, 10 colunas x 10 linhas)
   ============================================================ */
function buildBoardDOM() {
  $('#board-room-code').textContent = roomCode;
  const track = $('#board-track');
  track.innerHTML = '';
  const cols = 10;
  for (let row = 0; row < 10; row++) {
    const rowStartNumber = row * 10 + 1;
    const leftToRight = row % 2 === 0;
    const rowEl = document.createElement('div');
    rowEl.className = 'board-row';
    for (let c = 0; c < cols; c++) {
      const num = leftToRight ? rowStartNumber + c : rowStartNumber + (cols - 1 - c);
      const cellData = boardCells[num];
      const cellEl = document.createElement('div');
      cellEl.className = 'cell';
      cellEl.id = `cell-${num}`;
      cellEl.dataset.num = num;
      if (cellData.isStart) cellEl.classList.add('cell-start');
      else if (cellData.isFinish) cellEl.classList.add('cell-finish');
      else if (cellData.special) cellEl.classList.add('cell-special', `cat-${getEvent(cellData.event).cat}`);
      cellEl.innerHTML = `
        <span class="cell-num">${num}</span>
        <span class="cell-icon">${cellData.isStart ? '🏁' : cellData.isFinish ? '🏆' : (cellData.special ? CATEGORY_HIDDEN_ICON[getEvent(cellData.event).cat] : '')}</span>
        <div class="cell-pawns" id="pawns-${num}"></div>`;
      rowEl.appendChild(cellEl);
    }
    track.appendChild(rowEl);
  }
}

function renderBoard(room) {
  const players = room.players || {};
  const order = room.order || [];

  // painel lateral (ranking + status)
  renderPanel(room);

  // reposiciona peões
  $$('.cell-pawns').forEach(el => el.innerHTML = '');
  const byCell = {};
  order.forEach(uid => {
    const p = players[uid];
    if (!p || p.finished) return;
    (byCell[p.position] = byCell[p.position] || []).push(uid);
  });
  Object.entries(byCell).forEach(([num, uids]) => {
    const holder = $(`#pawns-${num}`);
    if (!holder) return;
    holder.classList.toggle('crowded', uids.length > 1);
    uids.forEach(uid => {
      const p = players[uid];
      const pawn = document.createElement('div');
      pawn.className = 'pawn';
      pawn.style.background = colorHex(p.color);
      pawn.title = p.name;
      pawn.textContent = avatarEmoji(p.avatar);
      holder.appendChild(pawn);
    });
  });

  // centraliza a rolagem na casa do jogador da vez
  const currentUid = order[room.currentTurnIndex];
  const currentPlayer = players[currentUid];
  if (currentPlayer) {
    const cellEl = $(`#cell-${currentPlayer.position}`);
    cellEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // turno / dado
  renderTurnUI(room);

  // eventos pendentes (modal)
  if (room.pendingEvent && !document.getElementById('event-modal').classList.contains('show')) {
    showEventModal(room.pendingEvent, room);
  } else if (!room.pendingEvent) {
    hideEventModal();
  }

  if (room.pendingChoice) {
    showChoiceModal(room.pendingChoice, room);
  } else {
    hideChoiceModal();
  }
}

function renderPanel(room) {
  const players = room.players || {};
  const order = room.order || [];
  const ranked = [...order].sort((a, b) => {
    const pa = players[a], pb = players[b];
    if (pa.finished && pb.finished) return pa.finishRank - pb.finishRank;
    if (pa.finished) return -1;
    if (pb.finished) return 1;
    return pb.position - pa.position;
  });
  $('#panel-ranking').innerHTML = ranked.map((uid, i) => {
    const p = players[uid];
    const flags = [
      p.shield ? '🛡️' : '', p.extraLife ? '✨' : '', p.skipRounds > 0 ? `💤x${p.skipRounds}` : '',
      p.finished ? '🏆' : ''
    ].filter(Boolean).join(' ');
    return `<div class="panel-row ${uid === myUid ? 'me' : ''}">
      <span class="rank-pos">${i + 1}º</span>
      <span class="rank-avatar" style="background:${colorHex(p.color)}">${avatarEmoji(p.avatar)}</span>
      <span class="rank-name">${escapeHtml(p.name)}</span>
      <span class="rank-cell">${p.finished ? 'Chegou!' : `casa ${p.position}`}</span>
      <span class="rank-flags">${flags}</span>
    </div>`;
  }).join('');
}

function renderTurnUI(room) {
  const players = room.players || {};
  const order = room.order || [];
  const currentUid = order[room.currentTurnIndex];
  const currentPlayer = players[currentUid];
  if (!currentPlayer) return;

  $('#turn-banner').innerHTML = currentUid === myUid
    ? `🎯 <strong>É a sua vez!</strong>`
    : `⏳ Aguarde a jogada de <strong>${escapeHtml(currentPlayer.name)}</strong>`;

  const diceModal = $('#dice-modal');
  const myTurn = currentUid === myUid && room.phase === 'idle';
  diceModal.classList.toggle('show', myTurn || room.phase === 'rolling' || room.phase === 'moving');
  $('#dice-turn-name').textContent = currentUid === myUid ? 'Sua vez!' : `Vez de ${currentPlayer.name}`;
  $('#btn-dice').disabled = !(currentUid === myUid && room.phase === 'idle');
  $('#dice-hint').textContent = currentUid === myUid ? 'Toque no dado para jogar!' : `Aguardando ${currentPlayer.name}...`;

  const diceEl = $('#btn-dice');
  if (room.phase === 'rolling') {
    if (renderTurnUI._lastPhase !== 'rolling') SoundSystem.play('diceRoll');
    diceEl.classList.add('rolling');
    diceEl.textContent = '🎲';
  } else if (room.phase === 'moving') {
    diceEl.classList.remove('rolling');
    if (renderTurnUI._lastPhase !== 'moving' && room.diceResult) {
      SoundSystem.play('diceResult');
      toast(`🎲 ${currentPlayer.name} tirou ${room.diceResult}${room.diceSecond ? ` (dados: ${room.diceResult >= room.diceSecond ? room.diceResult : room.diceSecond}/${room.diceResult < room.diceSecond ? room.diceResult : room.diceSecond})` : ''}!`);
    }
    diceEl.textContent = ['', '⚀','⚁','⚂','⚃','⚄','⚅'][room.diceResult] || '🎲';
  } else {
    diceEl.classList.remove('rolling');
    diceEl.textContent = '🎲';
  }
  renderTurnUI._lastPhase = room.phase;

  // cronômetro visual (30s) — o anfitrião decide o auto-roll, aqui é só cosmético
  clearInterval(turnTimerInterval);
  if (room.phase === 'idle' && room.turnStartedAt) {
    const bar = $('#turn-timer-bar');
    turnTimerInterval = setInterval(() => {
      const elapsed = (Date.now() - room.turnStartedAt) / 1000;
      const pct = Math.max(0, 1 - elapsed / TURN_SECONDS);
      bar.style.width = `${pct * 100}%`;
    }, 200);
  }

  // watchdog do anfitrião: garante jogada automática se o tempo estourar
  if (isHost) startHostWatchdog();
}

function startHostWatchdog() {
  clearInterval(hostWatchdogInterval);
  hostWatchdogInterval = setInterval(async () => {
    if (!roomState || roomState.status !== 'playing' || roomState.phase !== 'idle') return;
    const started = roomState.turnStartedAt || 0;
    if (Date.now() - started > TURN_SECONDS * 1000) {
      toast('⏱️ Tempo esgotado — jogada automática!');
      await hostRollDice(true);
    }
  }, 1000);
}

/* ============================================================
   DADO — só o anfitrião calcula e valida o resultado
   ============================================================ */
async function onDiceTap() {
  const order = roomState.order || [];
  const currentUid = order[roomState.currentTurnIndex];
  if (currentUid !== myUid || roomState.phase !== 'idle') return;
  SoundSystem.play('diceTap');
  $('#btn-dice').disabled = true;

  if (isHost) {
    await hostRollDice(false);
  } else {
    // pede ao anfitrião pra rolar (o anfitrião está escutando este campo)
    await roomRef.child('rollRequest').set({ uid: myUid, at: Date.now() });
  }
}

// O anfitrião também escuta pedidos de jogadores não-anfitriões
function watchRollRequests() {
  db.ref(`rooms/${roomCode}/rollRequest`).on('value', async snap => {
    if (!isHost) return;
    const req = snap.val();
    if (!req) return;
    if (!roomState) return;
    const order = roomState.order || [];
    const currentUid = order[roomState.currentTurnIndex];
    if (req.uid === currentUid && roomState.phase === 'idle') {
      await hostRollDice(false);
      db.ref(`rooms/${roomCode}/rollRequest`).remove();
    }
  });
}

async function hostRollDice(auto) {
  if (!isHost) return;
  await roomRef.update({ phase: 'rolling' });
  const currentUid = roomState.order[roomState.currentTurnIndex];
  const player = roomState.players[currentUid];
  let value = 1 + Math.floor(Math.random() * 6);
  let secondRoll = null;
  // efeitos de "dobro" ficam guardados no jogador (setados por evento anterior)
  if (player.doubleDiceMode === 'high' || player.doubleDiceMode === 'low') {
    secondRoll = 1 + Math.floor(Math.random() * 6);
    value = player.doubleDiceMode === 'high' ? Math.max(value, secondRoll) : Math.min(value, secondRoll);
  }
  await sleep(1200); // tempo de animação do dado (client-side toca o som/rotação)

  // efeito "preso na teia" — só se move se tirar mais que o valor exigido
  if (player.stuckUntil) {
    if (value <= player.stuckUntil) {
      await roomRef.update({
        diceResult: value, diceSecond: secondRoll, phase: 'moving',
        log: `🕸️ ${player.name} tirou ${value} e continua preso na teia! Precisa de mais que ${player.stuckUntil}.`
      });
      await sleep(1400);
      await hostEndTurn();
      return;
    } else {
      await db.ref(`rooms/${roomCode}/players/${currentUid}/stuckUntil`).remove();
    }
  }

  await roomRef.update({
    diceResult: value, diceSecond: secondRoll, phase: 'moving',
    log: auto ? `⏱️ Tempo esgotado! ${player.name} tirou ${value} automaticamente.` : `🎲 ${player.name} tirou ${value}!`
  });
  if (player.doubleDiceMode) {
    await roomRef.child(`players/${currentUid}/doubleDiceMode`).remove();
  }
  await hostMovePlayer(currentUid, value, 0);
}

/* ============================================================
   MOVIMENTAÇÃO + RESOLUÇÃO DE EVENTOS (lógica do anfitrião)
   ============================================================ */
async function hostMovePlayer(uid, steps, chainDepth) {
  const playersPath = `rooms/${roomCode}/players`;
  const snap = await db.ref(playersPath).get();
  const players = snap.val();
  const player = players[uid];
  let pos = player.position;
  const target = Math.min(100, Math.max(1, pos + steps));
  const dir = target >= pos ? 1 : -1;

  // Efeito de "preso" (stuck_until) — não se move até validar a condição na sua própria casa
  // (tratado antes de chamar esta função quando aplicável)

  // move casa por casa (client anima sozinho ao ouvir diceResult mudar;
  // aqui o anfitrião só grava o destino final e o histórico de passos)
  await db.ref(`${playersPath}/${uid}/position`).set(target);
  await animateSteps(uid, pos, target);

  if (target === 100) {
    await hostHandleFinish(uid);
    return;
  }

  const cellData = boardCells[target];
  if (cellData.special && chainDepth < MAX_CHAIN) {
    await hostResolveEvent(uid, cellData.event, chainDepth);
  } else {
    await hostEndTurn();
  }
}

function animateSteps(uid, from, to) {
  // animação cosmética simples: destaca a trilha percorrida
  return sleep(Math.min(1400, Math.abs(to - from) * 90 + 200));
}

async function hostResolveEvent(uid, eventId, chainDepth) {
  const ev = getEvent(eventId);
  const playersSnap = await db.ref(`rooms/${roomCode}/players`).get();
  const players = playersSnap.val();
  const player = players[uid];
  const order = roomState.order;

  // proteção contra evento negativo (escudo tem prioridade sobre a segunda chance)
  const isNegative = ev.cat === 'neg';
  if (isNegative && player.shield) {
    await db.ref(`rooms/${roomCode}/players/${uid}/shield`).set(false);
    await roomRef.update({ pendingEvent: { uid, eventId, blocked: true }, log: `🛡️ ${player.name} usou a proteção e escapou de "${ev.label}"!` });
    await sleep(1800);
    await roomRef.child('pendingEvent').remove();
    await hostEndTurn();
    return;
  }
  if (isNegative && player.extraLife) {
    await db.ref(`rooms/${roomCode}/players/${uid}/extraLife`).set(false);
    await roomRef.update({ pendingEvent: { uid, eventId, blocked: true }, log: `✨ ${player.name} usou a segunda chance e escapou de "${ev.label}"!` });
    await sleep(1800);
    await roomRef.child('pendingEvent').remove();
    await hostEndTurn();
    return;
  }

  await roomRef.update({ pendingEvent: { uid, eventId, blocked: false }, log: `${ev.icon} ${player.name}: ${ev.label}` });
  await sleep(2200);
  await roomRef.child('pendingEvent').remove();

  let followUpMove = null; // { steps } para encadear

  switch (ev.type) {
    case 'move':
      followUpMove = ev.amount;
      break;
    case 'reroll':
      await hostEndTurnKeepSamePlayer();
      return;
    case 'skip':
      await db.ref(`rooms/${roomCode}/players/${uid}/skipRounds`).transaction(v => (v || 0) + ev.amount);
      break;
    case 'jump_next_special': {
      const next = findNextSpecial(player.position);
      if (next) return applyGotoAndMaybeChain(uid, next, chainDepth);
      break;
    }
    case 'jump_prev_special': {
      const prev = findPrevSpecial(player.position);
      if (prev) return applyGotoAndMaybeChain(uid, prev, chainDepth);
      break;
    }
    case 'goto':
      return applyGotoAndMaybeChain(uid, ev.target, chainDepth);
    case 'swap_leader': {
      const leader = findLeader(players, order, uid);
      if (leader) await swapPositions(uid, leader);
      break;
    }
    case 'swap_last': {
      const last = findLast(players, order, uid);
      if (last) await swapPositions(uid, last);
      break;
    }
    case 'others_move': {
      const updates = {};
      order.forEach(o => {
        if (o === uid) return;
        const p = players[o];
        if (p.finished) return;
        updates[`players/${o}/position`] = clampPos(p.position + ev.amount);
      });
      await db.ref(`rooms/${roomCode}`).update(updates);
      break;
    }
    case 'choose_skip': case 'choose_move': case 'choose_swap':
      await roomRef.update({ pendingChoice: { uid, type: ev.type, amount: ev.amount || null, deadline: Date.now() + 20000 } });
      return; // turno só termina depois da escolha (hostResolveChoice)
    case 'leader_move': {
      const leader = findLeader(players, order, null);
      if (leader) await db.ref(`rooms/${roomCode}/players/${leader}/position`).transaction(v => clampPos(v + ev.amount));
      break;
    }
    case 'last_move': {
      const last = findLast(players, order, null);
      if (last) await db.ref(`rooms/${roomCode}/players/${last}/position`).transaction(v => clampPos(v + ev.amount));
      break;
    }
    case 'shield_gain':
      await db.ref(`rooms/${roomCode}/players/${uid}/shield`).set(true); break;
    case 'shield_lose':
      await db.ref(`rooms/${roomCode}/players/${uid}/shield`).set(false); break;
    case 'extra_life_gain':
      await db.ref(`rooms/${roomCode}/players/${uid}/extraLife`).set(true); break;
    case 'double_dice_high':
      await db.ref(`rooms/${roomCode}/players/${uid}/doubleDiceMode`).set('high'); break;
    case 'double_dice_low':
      await db.ref(`rooms/${roomCode}/players/${uid}/doubleDiceMode`).set('low'); break;
    case 'stuck_until':
      await db.ref(`rooms/${roomCode}/players/${uid}/stuckUntil`).set(ev.amount); break;
    case 'shuffle_all': {
      const positions = order.filter(o => !players[o].finished).map(o => players[o].position);
      const shuffled = [...positions].sort(() => Math.random() - 0.5);
      const updates = {};
      order.filter(o => !players[o].finished).forEach((o, i) => updates[`players/${o}/position`] = shuffled[i]);
      await db.ref(`rooms/${roomCode}`).update(updates);
      break;
    }
    case 'nothing': default: break;
  }

  if (followUpMove !== null) {
    await hostMovePlayer(uid, followUpMove, chainDepth + 1);
    return;
  }
  await hostEndTurn();
}

async function applyGotoAndMaybeChain(uid, target, chainDepth) {
  target = clampPos(target);
  await db.ref(`rooms/${roomCode}/players/${uid}/position`).set(target);
  await animateSteps(uid, roomState.players[uid].position, target);
  if (target === 100) { await hostHandleFinish(uid); return; }
  const cellData = boardCells[target];
  if (cellData.special && chainDepth + 1 < MAX_CHAIN) {
    await hostResolveEvent(uid, cellData.event, chainDepth + 1);
  } else {
    await hostEndTurn();
  }
}

async function swapPositions(uidA, uidB) {
  const a = roomState.players[uidA].position;
  const b = roomState.players[uidB].position;
  await db.ref(`rooms/${roomCode}`).update({
    [`players/${uidA}/position`]: b,
    [`players/${uidB}/position`]: a,
  });
  SoundSystem.play('swap');
}

function findLeader(players, order, excludeUid) {
  let best = null, bestPos = -1;
  order.forEach(uid => {
    if (uid === excludeUid) return;
    const p = players[uid];
    if (p.finished) return;
    if (p.position > bestPos) { bestPos = p.position; best = uid; }
  });
  return best;
}
function findLast(players, order, excludeUid) {
  let worst = null, worstPos = 1000;
  order.forEach(uid => {
    if (uid === excludeUid) return;
    const p = players[uid];
    if (p.finished) return;
    if (p.position < worstPos) { worstPos = p.position; worst = uid; }
  });
  return worst;
}
function findNextSpecial(from) {
  for (let i = from + 1; i <= 99; i++) if (boardCells[i].special) return i;
  return null;
}
function findPrevSpecial(from) {
  for (let i = from - 1; i >= 2; i--) if (boardCells[i].special) return i;
  return null;
}
function clampPos(p) { return Math.min(100, Math.max(1, p)); }

/* ---------- escolha entre jogadores (choose_*) ---------- */
function showChoiceModal(choice, room) {
  const modal = $('#choice-modal');
  modal.classList.add('show');
  const amChooser = choice.uid === myUid;
  const chooserName = room.players[choice.uid]?.name;
  $('#choice-title').textContent = amChooser ? 'Escolha um jogador!' : `${chooserName} está escolhendo um jogador...`;
  const list = $('#choice-list');
  list.innerHTML = '';
  if (amChooser) {
    room.order.filter(uid => uid !== choice.uid && !room.players[uid].finished).forEach(uid => {
      const p = room.players[uid];
      const btn = document.createElement('button');
      btn.className = 'choice-option';
      btn.innerHTML = `${avatarEmoji(p.avatar)} ${escapeHtml(p.name)}`;
      btn.onclick = () => hostResolveChoice(choice, uid);
      list.appendChild(btn);
    });
  }
}
function hideChoiceModal() { $('#choice-modal').classList.remove('show'); }

async function hostResolveChoice(choice, targetUid) {
  if (!isHost && choice.uid !== myUid) return;
  // se quem escolheu não é o anfitrião, envia a escolha; o anfitrião aplica
  if (!isHost) {
    await roomRef.child('choiceResult').set({ chooser: choice.uid, target: targetUid, at: Date.now() });
    return;
  }
  await applyChoice(choice, targetUid);
}

function watchChoiceResults() {
  db.ref(`rooms/${roomCode}/choiceResult`).on('value', async snap => {
    if (!isHost) return;
    const res = snap.val();
    if (!res || !roomState.pendingChoice) return;
    await applyChoice(roomState.pendingChoice, res.target);
    db.ref(`rooms/${roomCode}/choiceResult`).remove();
  });
}

async function applyChoice(choice, targetUid) {
  const players = roomState.players;
  if (choice.type === 'choose_skip') {
    await db.ref(`rooms/${roomCode}/players/${targetUid}/skipRounds`).transaction(v => (v || 0) + 1);
  } else if (choice.type === 'choose_move') {
    await db.ref(`rooms/${roomCode}/players/${targetUid}/position`).transaction(v => clampPos(v + choice.amount));
  } else if (choice.type === 'choose_swap') {
    await swapPositions(choice.uid, targetUid);
  }
  await roomRef.child('pendingChoice').remove();
  await hostEndTurn();
}

// auto-escolha caso o tempo esgote (watchdog do anfitrião)
function watchChoiceTimeout() {
  setInterval(() => {
    if (!isHost || !roomState || !roomState.pendingChoice) return;
    if (Date.now() > roomState.pendingChoice.deadline) {
      const candidates = roomState.order.filter(u => u !== roomState.pendingChoice.uid && !roomState.players[u].finished);
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      if (target) applyChoice(roomState.pendingChoice, target);
    }
  }, 1500);
}

/* ---------- fim de turno / chegada / pódio ---------- */
async function hostEndTurn() {
  const order = roomState.order;
  let idx = roomState.currentTurnIndex;
  let nextIdx = idx;
  let guard = 0;
  const skipMsgs = [];
  do {
    nextIdx = (nextIdx + 1) % order.length;
    const nextUid = order[nextIdx];
    const nextPlayer = roomState.players[nextUid];
    if (nextPlayer.finished) { guard++; continue; }
    if (nextPlayer.skipRounds > 0) {
      skipMsgs.push(nextPlayer.name);
      await db.ref(`rooms/${roomCode}/players/${nextUid}/skipRounds`).transaction(v => Math.max(0, v - 1));
      guard++;
      continue;
    }
    break;
  } while (guard < order.length * 2);

  await roomRef.update({
    currentTurnIndex: nextIdx, phase: 'idle', diceResult: null,
    turnStartedAt: Date.now(),
    log: skipMsgs.length ? `💤 ${skipMsgs.join(', ')} ficou(aram) sem jogar nesta rodada.` : roomState.log,
  });
}

async function hostEndTurnKeepSamePlayer() {
  await roomRef.update({ phase: 'idle', diceResult: null, turnStartedAt: Date.now(), log: '🎲 Jogue novamente!' });
}

async function hostHandleFinish(uid) {
  SoundSystem.play('finish');
  const finishedSoFar = Object.values(roomState.players).filter(p => p.finished).length;
  const rank = finishedSoFar + 1;
  await db.ref(`rooms/${roomCode}/players/${uid}`).update({ finished: true, finishRank: rank });

  const order = roomState.order;
  const totalPlayers = order.length;
  const stillPlaying = order.filter(o => o !== uid && !roomState.players[o].finished);

  if (stillPlaying.length <= 1) {
    // último jogador restante é automaticamente o loser (último colocado)
    if (stillPlaying.length === 1) {
      const lastUid = stillPlaying[0];
      await db.ref(`rooms/${roomCode}/players/${lastUid}`).update({ finished: true, finishRank: rank + 1 });
    }
    await roomRef.update({ status: 'finished' });
    return;
  }
  await hostEndTurn();
}

/* ============================================================
   TELA FINAL / PÓDIO
   ============================================================ */
function renderFinalScreen(room) {
  SoundSystem.play('finalScreen');
  const players = room.players;
  const ranked = Object.entries(players).sort((a, b) => a[1].finishRank - b[1].finishRank);
  const podiumWrap = $('#podium');
  const loserWrap = $('#loser-area');
  podiumWrap.innerHTML = '';
  loserWrap.innerHTML = '';

  const top3 = ranked.slice(0, Math.min(3, ranked.length - (ranked.length === 4 ? 1 : 0)));
  const last = ranked[ranked.length - 1];

  const order = [1, 0, 2]; // centro(1º), esquerda(2º), direita(3º) na exibição
  const podiumHeights = { 0: 'gold', 1: 'silver', 2: 'bronze' };
  const displaySlots = [top3[1], top3[0], top3[2]].filter(Boolean);
  const medalIcon = ['🥈', '🥇', '🥉'];

  displaySlots.forEach((entry, i) => {
    if (!entry) return;
    const [uid, p] = entry;
    const div = document.createElement('div');
    div.className = `podium-slot slot-${i}`;
    div.innerHTML = `
      ${i === 1 ? '<div class="crown">👑</div>' : ''}
      <div class="podium-avatar" style="background:${colorHex(p.color)}">${avatarEmoji(p.avatar)}</div>
      <div class="podium-name">${escapeHtml(p.name)}</div>
      <div class="podium-medal">${medalIcon[i]}</div>
    `;
    podiumWrap.appendChild(div);
  });

  if (last && ranked.length === 4) {
    const [uid, p] = last;
    const phrase = LOSER_PHRASES[Math.floor(Math.random() * LOSER_PHRASES.length)];
    loserWrap.innerHTML = `
      <div class="loser-card">
        <div class="podium-avatar loser-avatar" style="background:${colorHex(p.color)}">${avatarEmoji(p.avatar)}</div>
        <div class="loser-tag">LOSER</div>
        <div class="loser-name">${escapeHtml(p.name)}</div>
        <div class="loser-phrase">"${phrase}"</div>
      </div>`;
  } else if (last) {
    loserWrap.innerHTML = '';
  }

  $('#btn-play-again').style.display = players[myUid]?.isHost ? 'block' : 'none';
}

async function hostReturnToWaitingRoom() {
  if (!isHost) return;
  const updates = { status: 'waiting', order: null, currentTurnIndex: null, phase: null, pendingEvent: null, pendingChoice: null, seed: Math.floor(Math.random() * 2 ** 31) };
  Object.keys(roomState.players).forEach(uid => {
    updates[`players/${uid}/position`] = 1;
    updates[`players/${uid}/finished`] = false;
    updates[`players/${uid}/finishRank`] = null;
    updates[`players/${uid}/skipRounds`] = 0;
    updates[`players/${uid}/shield`] = false;
    updates[`players/${uid}/extraLife`] = false;
    updates[`players/${uid}/doubleDiceMode`] = null;
  });
  boardCells = null;
  await roomRef.update(updates);
}

async function leaveRoom() {
  if (!roomRef) { location.reload(); return; }
  await db.ref(`rooms/${roomCode}/players/${myUid}`).remove();
  location.reload();
}

/* ============================================================
   EVENTO — modal exibido pra todos quando alguém cai em casa especial
   ============================================================ */
function showEventModal(pending, room) {
  const modal = $('#event-modal');
  modal.classList.add('show');
  const ev = getEvent(pending.eventId);
  const player = room.players[pending.uid];
  SoundSystem.play(pending.blocked ? 'eventPositive' : (ev.cat === 'neg' ? 'eventNegative' : 'eventPositive'));
  $('#event-icon').textContent = pending.blocked ? '🛡️' : ev.icon;
  $('#event-cat').textContent = pending.blocked ? 'PROTEGIDO!' : (CATEGORY_LABEL[ev.cat] || '').toUpperCase();
  $('#event-title').textContent = pending.blocked ? 'ESCUDO ATIVADO!' : ev.label;
  $('#event-desc').innerHTML = pending.blocked
    ? `<strong>${escapeHtml(player.name)}</strong> tinha proteção e escapou de "${ev.label}"!`
    : `<strong>${escapeHtml(player.name)}</strong> ${ev.desc}`;
}
function hideEventModal() { $('#event-modal').classList.remove('show'); }

/* ============================================================
   Utilitários
   ============================================================ */
function avatarEmoji(id) { return (AVATARS.find(a => a.id === id) || AVATARS[0]).emoji; }
function colorHex(id) { return (COLORS.find(c => c.id === id) || COLORS[0]).hex; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ativa os observadores extras assim que uma sala é criada/entrada
const _origAttach = attachRoomListeners;
attachRoomListeners = function () {
  _origAttach();
  watchRollRequests();
  watchChoiceResults();
  watchChoiceTimeout();
};
