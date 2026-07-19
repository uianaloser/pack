/* ============================================================
   UIANA LOSER PRO MAX — sound.js
   Sistema de sons. Por padrão, sintetiza efeitos simples via
   Web Audio API (não depende de arquivos externos, funciona
   imediatamente). Se você adicionar arquivos .mp3/.ogg reais na
   pasta /sounds, basta preencher o objeto SOUND_FILES abaixo —
   o sistema passa a usá-los automaticamente no lugar do sintetizador.
   ============================================================ */

// Preencha aqui para usar arquivos reais, ex: click: 'sounds/click.mp3'
const SOUND_FILES = {
  click: null, join: null, leave: null, countdown: null, roulette: null,
  reveal: null, turnStart: null, diceTap: null, diceRoll: null, diceResult: null,
  step: null, eventPositive: null, eventNegative: null, portal: null,
  moveBack: null, moveForward: null, skipTurn: null, swap: null,
  finish: null, place1: null, place2: null, place3: null, placeLast: null,
  confetti: null, finalScreen: null,
};

const SoundSystem = (() => {
  let ctx = null;
  let enabled = true;
  let unlocked = false;
  const audioCache = {};

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  }

  // Toca um "beep" sintetizado simples com envelope de volume
  function beep({ freq = 440, duration = 0.12, type = 'sine', gain = 0.15, slideTo = null, delay = 0 }) {
    if (!enabled || !unlocked) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function playFile(url) {
    if (!enabled) return;
    let audio = audioCache[url];
    if (!audio) {
      audio = new Audio(url);
      audioCache[url] = audio;
    }
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  const SYNTH = {
    click: () => beep({ freq: 520, duration: 0.06, type: 'square', gain: 0.1 }),
    join: () => { beep({ freq: 440, duration: 0.1 }); beep({ freq: 660, duration: 0.12, delay: 0.08 }); },
    leave: () => beep({ freq: 300, duration: 0.15, slideTo: 150 }),
    countdown: () => beep({ freq: 700, duration: 0.08, type: 'square' }),
    roulette: () => beep({ freq: 300, duration: 0.05, type: 'square', gain: 0.06 }),
    reveal: () => { beep({ freq: 523 }); beep({ freq: 659, delay: 0.08 }); beep({ freq: 784, delay: 0.16 }); },
    turnStart: () => beep({ freq: 392, duration: 0.15, type: 'triangle' }),
    diceTap: () => beep({ freq: 600, duration: 0.05, type: 'square' }),
    diceRoll: () => { for (let i = 0; i < 6; i++) beep({ freq: 300 + i * 40, duration: 0.05, type: 'square', gain: 0.07, delay: i * 0.07 }); },
    diceResult: () => { beep({ freq: 784, duration: 0.15 }); beep({ freq: 988, duration: 0.15, delay: 0.1 }); },
    step: () => beep({ freq: 500, duration: 0.04, type: 'square', gain: 0.08 }),
    eventPositive: () => { beep({ freq: 523 }); beep({ freq: 659, delay: 0.1 }); beep({ freq: 880, delay: 0.2 }); },
    eventNegative: () => { beep({ freq: 300, duration: 0.2, type: 'sawtooth', slideTo: 120 }); },
    portal: () => beep({ freq: 220, duration: 0.4, type: 'sine', slideTo: 880 }),
    moveBack: () => beep({ freq: 400, duration: 0.1, slideTo: 200 }),
    moveForward: () => beep({ freq: 400, duration: 0.1, slideTo: 700 }),
    skipTurn: () => beep({ freq: 250, duration: 0.3, type: 'triangle', slideTo: 150 }),
    swap: () => { beep({ freq: 500 }); beep({ freq: 400, delay: 0.1 }); },
    finish: () => { beep({ freq: 523 }); beep({ freq: 659, delay: 0.1 }); beep({ freq: 784, delay: 0.2 }); beep({ freq: 1046, delay: 0.3 }); },
    place1: () => { beep({ freq: 659 }); beep({ freq: 880, delay: 0.12 }); beep({ freq: 1318, delay: 0.24 }); },
    place2: () => { beep({ freq: 587 }); beep({ freq: 784, delay: 0.12 }); },
    place3: () => { beep({ freq: 523 }); beep({ freq: 659, delay: 0.12 }); },
    placeLast: () => beep({ freq: 200, duration: 0.4, type: 'sawtooth', slideTo: 80 }),
    confetti: () => { for (let i = 0; i < 5; i++) beep({ freq: 600 + Math.random() * 400, duration: 0.08, gain: 0.07, delay: i * 0.05 }); },
    finalScreen: () => { beep({ freq: 392 }); beep({ freq: 523, delay: 0.15 }); beep({ freq: 659, delay: 0.3 }); },
  };

  function play(name) {
    if (!enabled) return;
    const file = SOUND_FILES[name];
    if (file) { playFile(file); return; }
    if (!unlocked) return; // aguarda 1ª interação do usuário
    if (SYNTH[name]) SYNTH[name]();
  }

  return {
    unlock: ensureCtx,
    play,
    toggle(v) { enabled = v !== undefined ? v : !enabled; return enabled; },
    isEnabled: () => enabled,
  };
})();
