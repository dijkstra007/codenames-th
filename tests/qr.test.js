import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard } from '../game.js';
import { THAI_WORDS } from '../words.js';
import { buildShareLink, encodeGame } from '../share.js';
import { encodeQr, qrToSvg } from '../qr.js';

function finderAt(modules, x0, y0) {
  const pattern = [
    '1111111',
    '1000001',
    '1011101',
    '1011101',
    '1011101',
    '1000001',
    '1111111',
  ];
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      assert.equal(modules[y0 + y][x0 + x], pattern[y][x] === '1');
    }
  }
}

describe('encodeQr', () => {
  it('places finder patterns on a version-2 URL code', () => {
    const qr = encodeQr('https://example.com');
    assert.equal(qr.version, 2);
    assert.equal(qr.size, 25);
    finderAt(qr.modules, 0, 0);
    finderAt(qr.modules, qr.size - 7, 0);
    finderAt(qr.modules, 0, qr.size - 7);
  });

  it('matches a known byte-mode matrix', () => {
    const qr = encodeQr('https://example.com');
    assert.equal(qr.mask, 0);
    assert.equal(qr.modules.map((row) => row.map((cell) => (cell ? '1' : '0')).join('')).join('\n'), [
      '1111111011100111001111111',
      '1000001011010011101000001',
      '1011101011000001101011101',
      '1011101010111011001011101',
      '1011101011001111001011101',
      '1000001001100111001000001',
      '1111111010101010101111111',
      '0000000011011110100000000',
      '0110101101011011101011111',
      '1100010110001000001000001',
      '1111011010000100000110111',
      '0101010010101001110000010',
      '0000111101011000111001011',
      '0010110010010000111001001',
      '1011001001011110101100111',
      '0101100001100001100010010',
      '1010111011101101111111000',
      '0000000011001101100011011',
      '1111111011101101101011011',
      '1000001000111010100011001',
      '1011101010100110111111001',
      '1011101000100011000111100',
      '1011101011010000100010001',
      '1000001011110110101011010',
      '1111111000000111111100011',
    ].join('\n'));
  });

  it('encodes a Thai board share link without throwing', () => {
    const board = createBoard(THAI_WORDS, () => 0.5);
    const code = encodeGame(board);
    const link = buildShareLink(code, {
      origin: 'https://dijkstra007.github.io',
      pathname: '/codenames-th/index.html',
    });
    const qr = encodeQr(link);
    assert.ok(qr.size >= 21);
    assert.equal(qr.modules.length, qr.size);
    finderAt(qr.modules, 0, 0);
  });

  it('rejects data that cannot fit a QR code', () => {
    assert.throws(() => encodeQr('x'.repeat(4000)), /too long/i);
  });
});

describe('qrToSvg', () => {
  it('renders a scannable SVG with a quiet zone and escaped label', () => {
    const svg = qrToSvg(encodeQr('https://example.com'), {
      label: 'คิวอาร์ "สายลับ"',
    });
    assert.match(svg, /^<svg /);
    assert.match(svg, /viewBox="0 0 33 33"/);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.match(svg, /aria-label="คิวอาร์ &quot;สายลับ&quot;"/);
    assert.match(svg, /<path fill="#000000" d="M/);
    assert.doesNotMatch(svg, /https:\/\/example\.com/);
  });
});
