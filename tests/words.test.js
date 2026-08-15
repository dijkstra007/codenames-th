import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../game.js';
import {
  THAI_TO_EN,
  THAI_WORDS,
  WORD_PAIRS,
  englishFor,
  spokenLabel,
} from '../words.js';

describe('word bank glosses', () => {
  it('keeps 458 unique Thai words with an English gloss for each', () => {
    assert.equal(WORD_PAIRS.length, 458);
    assert.equal(THAI_WORDS.length, 458);
    assert.equal(new Set(THAI_WORDS).size, 458);
    assert.equal(Object.keys(THAI_TO_EN).length, 458);

    for (const [th, en] of WORD_PAIRS) {
      assert.equal(typeof th, 'string');
      assert.ok(th.length >= 1);
      assert.equal(typeof en, 'string');
      assert.ok(en.trim().length >= 1);
      assert.match(en, /^[\x20-\x7E]+$/);
      assert.equal(englishFor(th), en);
      assert.equal(spokenLabel(th), `${th} (${en})`);
    }
  });

  it('labels lookalike Thai words with different English glosses', () => {
    assert.equal(englishFor('ชา'), 'Tea');
    assert.equal(englishFor('ขา'), 'Leg');
    assert.notEqual(englishFor('ชา'), englishFor('ขา'));
  });

  it('omits a gloss for unknown Thai text', () => {
    assert.equal(englishFor('ไม่มีในคลัง'), '');
    assert.equal(spokenLabel('ไม่มีในคลัง'), 'ไม่มีในคลัง');
  });

  it('still deals a board of Thai strings, not English', () => {
    const board = createBoard(THAI_WORDS, () => 0.5);
    assert.equal(board.words.length, 25);
    for (const word of board.words) {
      assert.ok(THAI_TO_EN[word]);
      assert.notEqual(word, englishFor(word));
    }
  });
});
