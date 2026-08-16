/** Encode / decode the spymaster share payload. No DOM. */

export const COLOR_TO_CHAR = { red: 'r', blue: 'b', neutral: 'n', assassin: 'a' };
export const CHAR_TO_COLOR = { r: 'red', b: 'blue', n: 'neutral', a: 'assassin' };

export const MAX_B64_LENGTH = 8192;
export const MAX_WORD_LENGTH = 40;
export const BOARD_SIZE = 25;

const ALLOWED_KEYS = new Set(['w', 'k']);

export class ShareError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ShareError';
  }
}

function bytesToBinary(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function toBase64Url(bytes) {
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeGame({ words, key }) {
  if (!Array.isArray(words) || words.length !== BOARD_SIZE) {
    throw new ShareError('จำนวนการ์ดไม่ครบ 25 ใบ');
  }
  if (!Array.isArray(key) || key.length !== BOARD_SIZE) {
    throw new ShareError('จำนวนการ์ดไม่ครบ 25 ใบ');
  }
  const k = key.map((c) => {
    const ch = COLOR_TO_CHAR[c];
    if (!ch) throw new ShareError('รหัสสีไม่ถูกต้อง');
    return ch;
  }).join('');
  const json = JSON.stringify({ w: words, k });
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeGame(code) {
  if (typeof code !== 'string') throw new ShareError('รูปแบบข้อมูลไม่ถูกต้อง');
  const trimmed = code.trim();
  if (!trimmed) throw new ShareError('กรุณาวางรหัสก่อน');
  if (trimmed.length > MAX_B64_LENGTH) throw new ShareError('รหัสยาวเกินไป');
  if (!/^[A-Za-z0-9\-_]+$/.test(trimmed)) throw new ShareError('รูปแบบข้อมูลไม่ถูกต้อง');

  let json;
  try {
    json = new TextDecoder().decode(fromBase64Url(trimmed));
  } catch {
    throw new ShareError('รูปแบบข้อมูลไม่ถูกต้อง');
  }

  if (json.length > MAX_B64_LENGTH) throw new ShareError('รหัสยาวเกินไป');

  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ShareError('รูปแบบข้อมูลไม่ถูกต้อง');
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ShareError('รูปแบบข้อมูลไม่ถูกต้อง');
  }

  const keys = Object.keys(data);
  if (keys.length !== 2 || keys.some((key) => !ALLOWED_KEYS.has(key))) {
    throw new ShareError('รูปแบบข้อมูลไม่ถูกต้อง');
  }

  if (!Array.isArray(data.w) || typeof data.k !== 'string') {
    throw new ShareError('รูปแบบข้อมูลไม่ถูกต้อง');
  }
  if (data.w.length !== BOARD_SIZE || data.k.length !== BOARD_SIZE) {
    throw new ShareError('จำนวนการ์ดไม่ครบ 25 ใบ');
  }

  const words = [];
  for (const word of data.w) {
    if (typeof word !== 'string' || word.length < 1 || word.length > MAX_WORD_LENGTH) {
      throw new ShareError('คำบนการ์ดไม่ถูกต้อง');
    }
    if (/[\u0000-\u001f]/.test(word)) throw new ShareError('คำบนการ์ดไม่ถูกต้อง');
    words.push(word);
  }

  const key = [];
  for (const ch of data.k) {
    const color = CHAR_TO_COLOR[ch];
    if (!color) throw new ShareError('รหัสสีไม่ถูกต้อง');
    key.push(color);
  }

  return { words, key };
}

export function extractCode(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s) return '';

  // Full or relative URLs: prefer ?c= (QR-safe), then #hash
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('/') || s.includes('?') || s.includes('#')) {
    try {
      const url = new URL(s, 'https://example.invalid/');
      const fromQuery = url.searchParams.get('c');
      if (fromQuery && fromQuery.trim()) return fromQuery.trim();
      const fromHash = url.hash.replace(/^#/, '').trim();
      if (fromHash) return fromHash;
    } catch {
      /* fall through */
    }
  }

  if (s.includes('#')) return s.slice(s.indexOf('#') + 1).trim();
  return s;
}

export function buildShareLink(code, { origin, pathname } = {}) {
  const base = origin + pathname.replace(/[^/]*$/, '');
  // Query param survives more QR / in-app browsers than a #hash fragment.
  return base + 'spymaster.html?c=' + encodeURIComponent(code);
}
