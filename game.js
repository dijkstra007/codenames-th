/** Pure game rules — no DOM. Safe to import from Node tests. */

export const COLOR_MARK = {
  red: 'แดง',
  blue: 'น้ำเงิน',
  neutral: 'กลาง',
  assassin: 'ฆ่า',
};

export const COLOR_ARIA = {
  red: 'ทีมแดง',
  blue: 'ทีมน้ำเงิน',
  neutral: 'กลาง',
  assassin: 'นักฆ่า',
};

export function otherTeam(team) {
  return team === 'red' ? 'blue' : 'red';
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createBoard(wordBank, rng = Math.random) {
  if (!Array.isArray(wordBank) || wordBank.length < 25) {
    throw new Error('word bank must have at least 25 words');
  }

  const words = shuffle(wordBank, rng).slice(0, 25);
  const firstTeam = rng() < 0.5 ? 'red' : 'blue';
  const secondTeam = otherTeam(firstTeam);

  const colors = [];
  for (let i = 0; i < 9; i++) colors.push(firstTeam);
  for (let i = 0; i < 8; i++) colors.push(secondTeam);
  for (let i = 0; i < 7; i++) colors.push('neutral');
  colors.push('assassin');

  return {
    words,
    key: shuffle(colors, rng),
    revealed: Array(25).fill(false),
    firstTeam,
    currentTurn: firstTeam,
    gameOver: false,
    winner: null,
    lastReveal: null,
  };
}

export function countRemaining(key, revealed) {
  let red = 0;
  let blue = 0;
  for (let i = 0; i < key.length; i++) {
    if (revealed[i]) continue;
    if (key[i] === 'red') red++;
    if (key[i] === 'blue') blue++;
  }
  return { red, blue };
}

export function teamComplete(key, revealed, team) {
  return key.every((color, i) => color !== team || revealed[i]);
}

export function countKey(key) {
  const counts = { red: 0, blue: 0, neutral: 0, assassin: 0 };
  for (const color of key) {
    if (counts[color] !== undefined) counts[color]++;
  }
  return counts;
}

export function assassinReason(loser) {
  return 'ทีม' + (loser === 'red' ? 'แดง' : 'น้ำเงิน') + 'แตะนักฆ่า — แพ้ทันที';
}

export function winReason(team) {
  return team === 'red' ? 'ทีมแดงเปิดการ์ดครบแล้ว' : 'ทีมน้ำเงินเปิดการ์ดครบแล้ว';
}

export function canUndo(state) {
  return !state.gameOver && !!state.lastReveal;
}

/**
 * Apply a reveal. Returns a new state plus metadata.
 * In strict mode, a bystander or opponent card ends the turn.
 * Assassin is always an instant loss for the current team.
 */
export function applyReveal(state, index, { strict = true } = {}) {
  if (
    !state ||
    state.gameOver ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 25 ||
    state.revealed[index]
  ) {
    return { state, applied: false, endedTurn: false, color: null, reason: null };
  }

  const revealed = state.revealed.slice();
  revealed[index] = true;
  const color = state.key[index];
  const previousTurn = state.currentTurn;

  let currentTurn = state.currentTurn;
  let gameOver = false;
  let winner = null;
  let reason = null;
  let endedTurn = false;

  if (color === 'assassin') {
    gameOver = true;
    winner = otherTeam(previousTurn);
    reason = assassinReason(previousTurn);
  } else if (teamComplete(state.key, revealed, 'red')) {
    gameOver = true;
    winner = 'red';
    reason = winReason('red');
  } else if (teamComplete(state.key, revealed, 'blue')) {
    gameOver = true;
    winner = 'blue';
    reason = winReason('blue');
  } else if (strict && color !== previousTurn) {
    currentTurn = otherTeam(previousTurn);
    endedTurn = true;
  }

  return {
    state: {
      ...state,
      revealed,
      currentTurn,
      gameOver,
      winner,
      lastReveal: { index, previousTurn, endedTurn },
    },
    applied: true,
    endedTurn,
    color,
    reason,
  };
}

export function undoReveal(state) {
  if (!canUndo(state)) return state;
  const { index, previousTurn } = state.lastReveal;
  const revealed = state.revealed.slice();
  revealed[index] = false;
  return {
    ...state,
    revealed,
    currentTurn: previousTurn,
    lastReveal: null,
  };
}
