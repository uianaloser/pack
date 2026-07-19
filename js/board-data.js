/* ============================================================
   UIANA LOSER PRO MAX — board-data.js
   Define os tipos de casa/evento e gera o layout das 100 casas.
   O layout é gerado com uma seed compartilhada (criada pelo
   anfitrião e salva no Firebase) para que TODOS os jogadores
   vejam exatamente o mesmo tabuleiro na mesma partida.
   ============================================================ */

// PRNG determinístico simples (mulberry32) — a partir de uma seed numérica
// gera sempre a mesma sequência de números "aleatórios". Isso é o que
// garante que todo mundo na sala enxergue o mesmo tabuleiro.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catálogo de pegadinhas. "cat" define a categoria visual (cor/ícone da casa).
// "apply(ctx)" recebe o contexto do turno e retorna um objeto de resultado
// que o motor de jogo (game.js) usa para mover peças, bloquear turnos, etc.
const EVENTS = [
  { id: 'avanca2', icon: '➡️', cat: 'pos', label: 'Avançou 2 casas!', desc: 'Um vento generoso empurrou você para frente.', type: 'move', amount: 2 },
  { id: 'avanca3', icon: '➡️', cat: 'pos', label: 'Avançou 3 casas!', desc: 'Atalho na trilha! Bora, bora!', type: 'move', amount: 3 },
  { id: 'avanca5', icon: '🚀', cat: 'pos', label: 'Avançou 5 casas!', desc: 'Um esquilo te deu carona.', type: 'move', amount: 5 },
  { id: 'avanca8', icon: '🚀', cat: 'pos', label: 'Avançou 8 casas!', desc: 'ATALHO SECRETO! Uau!', type: 'move', amount: 8 },
  { id: 'volta2', icon: '⬅️', cat: 'neg', label: 'Voltou 2 casas!', desc: 'Tropeçou numa raiz.', type: 'move', amount: -2 },
  { id: 'volta3', icon: '⬅️', cat: 'neg', label: 'Voltou 3 casas!', desc: 'Um sapo travesso empurrou você pra trás.', type: 'move', amount: -3 },
  { id: 'volta5', icon: '💥', cat: 'neg', label: 'Voltou 5 casas!', desc: 'Ponte quebrada! Que vergonha.', type: 'move', amount: -5 },
  { id: 'volta8', icon: '💥', cat: 'neg', label: 'Voltou 8 casas!', desc: 'Tempestade te jogou pra trás.', type: 'move', amount: -8 },
  { id: 'joga_de_novo', icon: '🎲', cat: 'pos', label: 'Jogue novamente!', desc: 'A sorte ainda não acabou pra você.', type: 'reroll' },
  { id: 'perde1', icon: '💤', cat: 'neg', label: 'Perdeu 1 rodada!', desc: 'Cochilou embaixo de uma árvore.', type: 'skip', amount: 1 },
  { id: 'perde2', icon: '😵', cat: 'neg', label: 'Perdeu 2 rodadas!', desc: 'Ficou preso na teia de aranha gigante.', type: 'skip', amount: 2 },
  { id: 'pula_para_especial', icon: '🌀', cat: 'surprise', label: 'Portal misterioso!', desc: 'Você foi teleportado para a próxima casa especial.', type: 'jump_next_special' },
  { id: 'volta_especial_anterior', icon: '🌀', cat: 'surprise', label: 'Portal reverso!', desc: 'Voltou para a casa especial anterior.', type: 'jump_prev_special' },
  { id: 'volta_inicio', icon: '🏚️', cat: 'neg', label: 'Voltou para o INÍCIO!', desc: 'Um trovão te mandou de volta pro começo.', type: 'goto', target: 1 },
  { id: 'troca_primeiro', icon: '🔄', cat: 'surprise', label: 'Trocou de posição com o líder!', desc: 'Vantagem repentina!', type: 'swap_leader' },
  { id: 'troca_ultimo', icon: '🔄', cat: 'neg', label: 'Trocou de posição com o último!', desc: 'Azar total!', type: 'swap_last' },
  { id: 'todos_avancam2', icon: '🎉', cat: 'surprise', label: 'Todos avançam 2 casas!', desc: 'A floresta inteira te ajudou (menos você).', type: 'others_move', amount: 2 },
  { id: 'todos_voltam2', icon: '🌩️', cat: 'neg', label: 'Todos voltam 2 casas!', desc: 'Uma tempestade atingiu a floresta toda.', type: 'others_move', amount: -2 },
  { id: 'escolhe_bloqueia', icon: '🎯', cat: 'choice', label: 'Escolha alguém para perder a vez!', desc: 'Aponte o dedo, sem dó.', type: 'choose_skip', amount: 1 },
  { id: 'escolhe_volta3', icon: '🎯', cat: 'choice', label: 'Escolha alguém para voltar 3 casas!', desc: 'A vingança é sua.', type: 'choose_move', amount: -3 },
  { id: 'escolhe_avanca3', icon: '🎯', cat: 'choice', label: 'Escolha alguém para avançar 3 casas!', desc: 'Seja generoso (ou nem tanto).', type: 'choose_move', amount: 3 },
  { id: 'escolhe_troca', icon: '🎯', cat: 'choice', label: 'Escolha alguém para trocar de posição!', desc: 'Troca é troca.', type: 'choose_swap' },
  { id: 'frente_volta', icon: '👑', cat: 'neg', label: 'O líder da corrida voltou 4 casas!', desc: 'Ninguém fica em primeiro por muito tempo.', type: 'leader_move', amount: -4 },
  { id: 'ultimo_avanca', icon: '🐢', cat: 'pos', label: 'O último colocado avançou 4 casas!', desc: 'Todo mundo merece uma chance.', type: 'last_move', amount: 4 },
  { id: 'protecao', icon: '🛡️', cat: 'pos', label: 'Ganhou proteção!', desc: 'A próxima pegadinha negativa não vai te afetar.', type: 'shield_gain' },
  { id: 'perde_protecao', icon: '🔓', cat: 'neg', label: 'Perdeu sua proteção!', desc: 'Seu escudo se quebrou.', type: 'shield_lose' },
  { id: 'segunda_chance', icon: '✨', cat: 'pos', label: 'Ganhou uma segunda chance!', desc: 'Se cair em algo ruim de novo, ela te salva.', type: 'extra_life_gain' },
  { id: 'dado_dobro_maior', icon: '🎲', cat: 'pos', label: 'Jogue 2 dados e use o MAIOR!', desc: 'Sorte em dobro.', type: 'double_dice_high' },
  { id: 'dado_dobro_menor', icon: '🎲', cat: 'neg', label: 'Jogue 2 dados e use o MENOR!', desc: 'Azar em dobro.', type: 'double_dice_low' },
  { id: 'preso_ate_maior3', icon: '🕸️', cat: 'neg', label: 'Preso até tirar mais que 3!', desc: 'A teia gigante te prende na casa.', type: 'stuck_until', amount: 3 },
  { id: 'animal_ajudante', icon: '🐿️', cat: 'pos', label: 'Um esquilo ajudante avançou você 4 casas!', desc: 'Amizade da floresta.', type: 'move', amount: 4 },
  { id: 'animal_travesso', icon: '🐸', cat: 'neg', label: 'Um sapo travesso te fez voltar 4 casas!', desc: 'Nem todo animal é seu amigo.', type: 'move', amount: -4 },
  { id: 'todos_trocam', icon: '🌪️', cat: 'surprise', label: 'Redemoinho! Todos trocaram de posição aleatoriamente!', desc: 'Caos total na floresta.', type: 'shuffle_all' },
  { id: 'nada_acontece', icon: '🍃', cat: 'surprise', label: 'Nada aconteceu... só uma folha caiu.', desc: 'A floresta só queria te dar um susto.', type: 'nothing' },
  { id: 'pula_casa_fixa_70', icon: '🌟', cat: 'surprise', label: 'Pulou direto para a casa 70!', desc: 'Um cogumelo gigante te lançou pra longe.', type: 'goto', target: 70 },
  { id: 'pula_casa_fixa_40', icon: '🌟', cat: 'surprise', label: 'Pulou direto para a casa 40!', desc: 'Um cogumelo gigante te lançou pra longe.', type: 'goto', target: 40 },
];

// Ícones de categoria (fallback antes de revelar o efeito)
const CATEGORY_HIDDEN_ICON = {
  pos: '❓', neg: '❓', surprise: '❓', choice: '❓'
};

const CATEGORY_LABEL = {
  pos: 'Sorte grande', neg: 'Armadilha', surprise: 'Surpresa', choice: 'Escolha'
};

/**
 * Gera o layout das 100 casas de forma determinística a partir de uma seed.
 * Regras seguidas do prompt:
 *  - 30 a 40 casas especiais
 *  - evitar casas especiais consecutivas
 *  - últimas 20 casas mais tensas (maior densidade de eventos)
 *  - casa 1 = início, casa 100 = chegada (nunca especiais)
 */
function generateBoard(seed) {
  const rand = mulberry32(seed);
  const totalSpecial = 30 + Math.floor(rand() * 11); // 30–40
  const cells = new Array(101).fill(null); // index 1..100 usado

  // Divide o tabuleiro em duas zonas: 2-80 (densidade normal) e 81-99 (mais tensa)
  const normalRange = [];
  for (let i = 2; i <= 80; i++) normalRange.push(i);
  const tenseRange = [];
  for (let i = 81; i <= 99; i++) tenseRange.push(i);

  // aproximadamente 65% das especiais na zona normal, 35% na zona tensa,
  // respeitando o máximo de casas não-consecutivas possível em cada zona
  // (numa faixa de N casas, no máximo ceil(N/2) podem ser não-consecutivas)
  const maxTense = Math.ceil(tenseRange.length / 2);
  const maxNormal = Math.ceil(normalRange.length / 2);
  let tenseCount = Math.min(maxTense, Math.round(totalSpecial * 0.35));
  let normalCount = Math.min(maxNormal, totalSpecial - tenseCount);
  // se sobrou alguma casa por causa dos limites, tenta realocar pro outro lado
  let leftover = totalSpecial - tenseCount - normalCount;
  if (leftover > 0) {
    const extraTense = Math.min(leftover, maxTense - tenseCount);
    tenseCount += extraTense;
    leftover -= extraTense;
    const extraNormal = Math.min(leftover, maxNormal - normalCount);
    normalCount += extraNormal;
  }

  // Um único conjunto "chosen" compartilhado entre as duas zonas, para que a
  // regra de não-consecutividade também valha na fronteira (ex: casa 80 e 81).
  const chosen = new Set();
  function pickNonConsecutive(pool, count) {
    const shuffled = [...pool].sort(() => rand() - 0.5);
    let added = 0;
    for (const idx of shuffled) {
      if (added >= count) break;
      if (chosen.has(idx - 1) || chosen.has(idx + 1)) continue;
      chosen.add(idx);
      added++;
    }
    // se não deu pra completar evitando consecutivos, preenche o resto sem a regra
    if (added < count) {
      for (const idx of shuffled) {
        if (added >= count) break;
        if (chosen.has(idx)) continue;
        chosen.add(idx);
        added++;
      }
    }
  }

  pickNonConsecutive(tenseRange, tenseCount); // zona tensa primeiro (prioridade)
  pickNonConsecutive(normalRange, normalCount);
  const specialIndices = chosen;

  for (const idx of specialIndices) {
    const ev = EVENTS[Math.floor(rand() * EVENTS.length)];
    cells[idx] = { number: idx, special: true, event: ev.id };
  }
  for (let i = 1; i <= 100; i++) {
    if (!cells[i]) cells[i] = { number: i, special: false };
  }
  cells[1].special = false;
  cells[1].isStart = true;
  cells[100].special = false;
  cells[100].isFinish = true;

  return cells; // array 1..100 (index 0 não usado)
}

function getEvent(id) {
  return EVENTS.find(e => e.id === id);
}

// Frases engraçadas aleatórias mostradas durante a partida
const FUN_MESSAGES = [
  'A sorte decidiu humilhar alguém.',
  'Preparem-se, losers!',
  'Esse dado não está do seu lado.',
  'O tabuleiro escolheu sua próxima vítima.',
  'Alguém vai se dar mal.',
  'A floresta está observando.',
  'Foi sorte ou foi talento? Foi sorte.',
  'Não comemore antes da casa 100.',
  'O último colocado ainda acredita na virada.',
  'O dado não aceita reclamações.',
  'Os esquilos estão fazendo fofoca sobre você.',
  'Ninguém está seguro nesta floresta.',
];

const LOSER_PHRASES = [
  'Temos um novo loser!',
  'Não foi dessa vez, loser!',
  'Alguém precisava ficar em último!',
  'Parabéns por perder com estilo!',
  'O verdadeiro UIANA LOSER PRO MAX!',
  'Treine sua sorte para a próxima!',
  'Até os animais da floresta chegaram primeiro!',
];
