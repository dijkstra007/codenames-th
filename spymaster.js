import { COLOR_ARIA, COLOR_MARK, countKey } from './game.js';
import { decodeGame, extractCode } from './share.js';
import {
  clearMasked,
  clearSavedMasked,
  emptyMasked,
  getSafeStorage,
  loadMasked,
  saveMasked,
  toggleMasked,
} from './spy-mask.js?v=spy-tap-3';
import { appendWordStack } from './word-ui.js';

const $importScreen = document.getElementById('importScreen');
const $importError  = document.getElementById('importError');
const $codeInput    = document.getElementById('codeInput');
const $loadBtn      = document.getElementById('loadBtn');
const $spyWarn      = document.getElementById('spyWarn');
const $spyMain      = document.getElementById('spyMain');
const $spyBoard     = document.getElementById('spyBoard');
const $spyControls  = document.getElementById('spyControls');
const $changeBtn    = document.getElementById('changeCodeBtn');
const $clearMaskBtn = document.getElementById('clearMaskBtn');
const $spySub       = document.getElementById('spySub');

let currentCode = '';
let currentGame = null;
let masked = emptyMasked();
let storage = getSafeStorage(null);

function refreshStorage() {
  try {
    storage = getSafeStorage(window.sessionStorage);
  } catch {
    storage = getSafeStorage(null);
  }
}

function codeFromLocation() {
  const q = new URLSearchParams(location.search).get('c');
  if (q && q.trim()) return q.trim();
  return location.hash.replace(/^#/, '').trim();
}

function setLocationCode(code) {
  const next = location.pathname + '?c=' + encodeURIComponent(code);
  if (location.pathname + location.search !== next) {
    history.replaceState(null, '', next);
  }
}

function cellLabel(game, index, isMasked) {
  const word = game.words[index];
  const team = COLOR_ARIA[game.key[index]] || '';
  const status = isMasked ? 'เปิดแล้ว' : 'ยังไม่เปิด';
  return `${word} · ${team} · ${status} — แตะเพื่อสลับ`;
}

function applyCellMask(cell, game, index, isMasked) {
  cell.classList.toggle('done', isMasked);
  cell.setAttribute('aria-pressed', String(isMasked));
  cell.setAttribute('aria-label', cellLabel(game, index, isMasked));
}

function setMasked(next) {
  masked = next;
  if (currentCode) saveMasked(storage, currentCode, masked);
  if ($clearMaskBtn) $clearMaskBtn.disabled = !masked.some(Boolean);
}

let lastTap = { index: -1, at: 0 };

function onToggle(index) {
  if (!currentGame || !Number.isInteger(index)) return;
  const now = Date.now();
  // Pointer + click can both fire on some WebViews; ignore the duplicate.
  if (lastTap.index === index && now - lastTap.at < 400) return;
  lastTap = { index, at: now };
  setMasked(toggleMasked(masked, index));
  const cell = $spyBoard.querySelector('[data-index="' + index + '"]');
  if (cell) applyCellMask(cell, currentGame, index, masked[index]);
}

function cellIndexFromEvent(e) {
  const el = e.target && e.target.closest ? e.target.closest('[data-index]') : null;
  if (!el || !$spyBoard.contains(el)) return null;
  const n = Number(el.getAttribute('data-index'));
  return Number.isInteger(n) ? n : null;
}

function render(game) {
  $spyBoard.replaceChildren();
  for (let i = 0; i < 25; i++) {
    const color = game.key[i];
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'key-cell spy-key-cell ' + color;
    cell.dataset.index = String(i);
    applyCellMask(cell, game, i, masked[i]);

    const mark = document.createElement('span');
    mark.className = 'team-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = COLOR_MARK[color];
    cell.appendChild(mark);

    appendWordStack(cell, game.words[i], 'key-word');

    const cover = document.createElement('span');
    cover.className = 'spy-mask-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.textContent = '✓';
    cell.appendChild(cover);

    $spyBoard.appendChild(cell);
  }
  const counts = countKey(game.key);
  $spySub.textContent = `ทีมแดง ${counts.red} · ทีมน้ำเงิน ${counts.blue} · กลาง ${counts.neutral} · นักฆ่า ${counts.assassin}`;
  if ($clearMaskBtn) $clearMaskBtn.disabled = !masked.some(Boolean);
}

function showGame(game, code) {
  currentGame = game;
  currentCode = code;
  refreshStorage();
  masked = loadMasked(storage, code);
  $importScreen.hidden = true;
  $spyWarn.hidden = false;
  $spyMain.hidden = false;
  $spyControls.hidden = false;
  render(game);
}

function showImport(errMsg) {
  currentGame = null;
  currentCode = '';
  masked = emptyMasked();
  $importScreen.hidden = false;
  $spyWarn.hidden = true;
  $spyMain.hidden = true;
  $spyControls.hidden = true;
  $spySub.textContent = 'หน้าสำหรับสายลับ';
  $importError.textContent = errMsg || '';
  setTimeout(() => $codeInput.focus(), 50);
}

function tryLoadFromCode(rawInput) {
  const code = extractCode(rawInput);
  if (!code) {
    showImport('กรุณาวางรหัสก่อน');
    return;
  }
  try {
    const game = decodeGame(code);
    setLocationCode(code);
    showGame(game, code);
  } catch (e) {
    showImport('ไม่สามารถอ่านรหัสได้: ' + (e && e.message ? e.message : 'รูปแบบไม่ถูกต้อง'));
  }
}

refreshStorage();

const initial = codeFromLocation();
if (initial) tryLoadFromCode(initial);
else showImport('');

$loadBtn.addEventListener('click', () => tryLoadFromCode($codeInput.value));
$codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    tryLoadFromCode($codeInput.value);
  }
});

$changeBtn.addEventListener('click', () => {
  history.replaceState(null, '', location.pathname);
  $codeInput.value = '';
  showImport('');
});

if ($clearMaskBtn) {
  $clearMaskBtn.addEventListener('click', () => {
    if (!currentGame || !currentCode) return;
    setMasked(clearMasked());
    clearSavedMasked(storage, currentCode);
    render(currentGame);
  });
}

// One board-level tap path so child text / overlays cannot swallow hits.
const tapStart = { x: 0, y: 0, id: null };

$spyBoard.addEventListener('pointerdown', (e) => {
  if (e.isPrimary === false) return;
  tapStart.x = e.clientX;
  tapStart.y = e.clientY;
  tapStart.id = e.pointerId;
}, { passive: true });

$spyBoard.addEventListener('pointerup', (e) => {
  if (tapStart.id != null && e.pointerId !== tapStart.id) return;
  tapStart.id = null;
  if (Math.abs(e.clientX - tapStart.x) > 14 || Math.abs(e.clientY - tapStart.y) > 14) return;
  const index = cellIndexFromEvent(e);
  if (index == null) return;
  onToggle(index);
}, { passive: true });

$spyBoard.addEventListener('click', (e) => {
  const index = cellIndexFromEvent(e);
  if (index == null) return;
  onToggle(index);
});

function reloadFromLocation() {
  const code = codeFromLocation();
  if (code) tryLoadFromCode(code);
}

window.addEventListener('hashchange', reloadFromLocation);
window.addEventListener('popstate', reloadFromLocation);
