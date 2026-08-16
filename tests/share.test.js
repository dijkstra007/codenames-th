import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../game.js';
import {
  MAX_B64_LENGTH,
  MAX_WORD_LENGTH,
  ShareError,
  buildShareLink,
  decodeGame,
  encodeGame,
  extractCode,
} from '../share.js';

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

const thaiWords = [
  'ช้าง', 'เสือ', 'สิงโต', 'หมี', 'หมา', 'แมว', 'ม้า', 'วัว', 'ควาย', 'หมู',
  'ไก่', 'เป็ด', 'นก', 'ปลา', 'ปู', 'กุ้ง', 'หอย', 'งู', 'จระเข้', 'เต่า',
  'กบ', 'ผีเสื้อ', 'แมลง', 'ผึ้ง', 'มด', 'ยุง', 'แมงมุม', 'ลิง', 'กระต่าย', 'หนู',
];

function validPayload() {
  const board = createBoard(thaiWords, mulberry32(99));
  return { words: board.words, key: board.key };
}

describe('encode / decode', () => {
  it('round-trips Thai words and the color key', () => {
    const payload = validPayload();
    const decoded = decodeGame(encodeGame(payload));
    assert.deepEqual(decoded.words, payload.words);
    assert.deepEqual(decoded.key, payload.key);
  });

  it('builds a spymaster query link under a project path', () => {
    const code = encodeGame(validPayload());
    const link = buildShareLink(code, {
      origin: 'https://example.github.io',
      pathname: '/codenames-th/index.html',
    });
    assert.equal(
      link,
      'https://example.github.io/codenames-th/spymaster.html?c=' + encodeURIComponent(code),
    );
  });

  it('extracts a code from a pasted URL or raw hash', () => {
    assert.equal(extractCode('  abc  '), 'abc');
    assert.equal(
      extractCode('https://x.github.io/codenames-th/spymaster.html#THECODE'),
      'THECODE',
    );
    assert.equal(
      extractCode('https://x.github.io/codenames-th/spymaster.html?c=QUERYCODE'),
      'QUERYCODE',
    );
    assert.equal(
      extractCode('https://x.github.io/codenames-th/spymaster.html?c=QUERYCODE#OLD'),
      'QUERYCODE',
    );
    assert.equal(extractCode(''), '');
  });
});

describe('decodeGame validation', () => {
  function tamper(mutator) {
    const payload = validPayload();
    mutator(payload);
    const json = JSON.stringify({ w: payload.words, k: payload.key.map((c) => (
      { red: 'r', blue: 'b', neutral: 'n', assassin: 'a' }[c]
    )).join('') });
    const utf8 = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of utf8) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  it('rejects extra JSON fields', () => {
    const payload = validPayload();
    const json = JSON.stringify({ w: payload.words, k: 'r'.repeat(25), x: 1 });
    const utf8 = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of utf8) binary += String.fromCharCode(byte);
    const code = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.throws(() => decodeGame(code), ShareError);
  });

  it('rejects a non-string word', () => {
    const code = tamper((p) => { p.words[0] = 123; });
    assert.throws(() => decodeGame(code), ShareError);
  });

  it('rejects an oversized word', () => {
    const code = tamper((p) => { p.words[0] = 'ก'.repeat(MAX_WORD_LENGTH + 1); });
    assert.throws(() => decodeGame(code), ShareError);
  });

  it('rejects the wrong card count', () => {
    const code = tamper((p) => { p.words = p.words.slice(0, 24); });
    assert.throws(() => decodeGame(code), /25/);
  });

  it('rejects an invalid color letter', () => {
    const payload = validPayload();
    payload.key[0] = 'red';
    const json = JSON.stringify({
      w: payload.words,
      k: 'x' + 'r'.repeat(24),
    });
    const utf8 = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of utf8) binary += String.fromCharCode(byte);
    const code = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.throws(() => decodeGame(code), /สี/);
  });

  it('rejects oversized and malformed codes before parse', () => {
    assert.throws(() => decodeGame('a'.repeat(MAX_B64_LENGTH + 1)), /ยาว/);
    assert.throws(() => decodeGame('!!!not-b64!!!'), ShareError);
    assert.throws(() => decodeGame(''), ShareError);
  });
});
