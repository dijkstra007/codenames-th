import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReveal,
  canUndo,
  countKey,
  countRemaining,
  createBoard,
  otherTeam,
  shuffle,
  teamComplete,
  undoReveal,
  winReason,
} from '../game.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleWords() {
  return Array.from({ length: 40 }, (_, i) => 'คำ' + i);
}

function baseState(overrides = {}) {
  const key = [
    ...Array(9).fill('red'),
    ...Array(8).fill('blue'),
    ...Array(7).fill('neutral'),
    'assassin',
  ];
  return {
    words: Array.from({ length: 25 }, (_, i) => 'W' + i),
    key,
    revealed: Array(25).fill(false),
    firstTeam: 'red',
    currentTurn: 'red',
    gameOver: false,
    winner: null,
    lastReveal: null,
    ...overrides,
  };
}

describe('shuffle / createBoard', () => {
  it('does not mutate the original array', () => {
    const src = [1, 2, 3, 4, 5];
    const copy = src.slice();
    shuffle(src, mulberry32(7));
    assert.deepEqual(src, copy);
  });

  it('builds a 9/8/7/1 key and 25 unique words', () => {
    const board = createBoard(sampleWords(), mulberry32(42));
    const counts = countKey(board.key);
    assert.equal(board.words.length, 25);
    assert.equal(new Set(board.words).size, 25);
    assert.equal(counts[board.firstTeam], 9);
    assert.equal(counts[otherTeam(board.firstTeam)], 8);
    assert.equal(counts.neutral, 7);
    assert.equal(counts.assassin, 1);
    assert.equal(board.currentTurn, board.firstTeam);
    assert.equal(board.gameOver, false);
    assert.deepEqual(countRemaining(board.key, board.revealed), {
      red: counts.red,
      blue: counts.blue,
    });
  });

  it('throws when the word bank is too small', () => {
    assert.throws(() => createBoard(['a', 'b'], () => 0.1), /25/);
  });
});

describe('applyReveal', () => {
  it('keeps the turn after a matching team card in strict mode', () => {
    const { state, applied, endedTurn, color } = applyReveal(baseState(), 0, { strict: true });
    assert.equal(applied, true);
    assert.equal(endedTurn, false);
    assert.equal(color, 'red');
    assert.equal(state.currentTurn, 'red');
    assert.equal(state.revealed[0], true);
    assert.equal(state.lastReveal.index, 0);
  });

  it('ends the turn on an opponent card in strict mode', () => {
    const { state, endedTurn } = applyReveal(baseState(), 9, { strict: true });
    assert.equal(endedTurn, true);
    assert.equal(state.currentTurn, 'blue');
    assert.equal(state.revealed[9], true);
  });

  it('ends the turn on a bystander in strict mode', () => {
    const { state, endedTurn } = applyReveal(baseState(), 17, { strict: true });
    assert.equal(endedTurn, true);
    assert.equal(state.currentTurn, 'blue');
  });

  it('does not auto-pass on a wrong color when strict is off', () => {
    const { state, endedTurn } = applyReveal(baseState(), 9, { strict: false });
    assert.equal(endedTurn, false);
    assert.equal(state.currentTurn, 'red');
  });

  it('assassin is an instant loss for the current team', () => {
    const { state, reason } = applyReveal(baseState(), 24, { strict: true });
    assert.equal(state.gameOver, true);
    assert.equal(state.winner, 'blue');
    assert.match(reason, /นักฆ่า/);
    assert.equal(canUndo(state), false);
  });

  it('winning by completing a team ends the game', () => {
    const revealed = Array(25).fill(false);
    for (let i = 0; i < 8; i++) revealed[i] = true;
    const { state, reason } = applyReveal(baseState({ revealed }), 8, { strict: true });
    assert.equal(state.gameOver, true);
    assert.equal(state.winner, 'red');
    assert.equal(reason, winReason('red'));
    assert.equal(teamComplete(state.key, state.revealed, 'red'), true);
  });

  it('revealing the opponent last card gives them the win', () => {
    const revealed = Array(25).fill(false);
    for (let i = 9; i <= 15; i++) revealed[i] = true;
    const { state } = applyReveal(baseState({ revealed }), 16, { strict: true });
    assert.equal(state.winner, 'blue');
    assert.equal(state.gameOver, true);
  });

  it('ignores double reveals and out-of-range indexes', () => {
    const once = applyReveal(baseState(), 0, { strict: true }).state;
    const twice = applyReveal(once, 0, { strict: true });
    assert.equal(twice.applied, false);
    assert.equal(applyReveal(baseState(), -1).applied, false);
    assert.equal(applyReveal(baseState(), 25).applied, false);
  });
});

describe('undoReveal', () => {
  it('restores the card and previous turn', () => {
    const after = applyReveal(baseState(), 9, { strict: true }).state;
    assert.equal(after.currentTurn, 'blue');
    const undone = undoReveal(after);
    assert.equal(undone.revealed[9], false);
    assert.equal(undone.currentTurn, 'red');
    assert.equal(undone.lastReveal, null);
    assert.equal(canUndo(undone), false);
  });

  it('does not undo after a game-ending reveal', () => {
    const after = applyReveal(baseState(), 24, { strict: true }).state;
    const undone = undoReveal(after);
    assert.equal(undone.revealed[24], true);
    assert.equal(undone.gameOver, true);
  });
});
