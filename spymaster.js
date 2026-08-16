import { COLOR_ARIA, COLOR_MARK, countKey } from './game.js';
import { decodeGame, extractCode } from './share.js';
import {
  clearMasked,
  clearSavedMasked,
  emptyMasked,
  loadMasked,
  saveMasked,
  toggleMasked,
} from './spy-mask.js';
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
  if (currentCode) saveMasked(sessionStorage, currentCode, masked);
  if ($clearMaskBtn) $clearMaskBtn.disabled = !masked.some(Boolean);
}

function onToggle(index) {
  if (!currentGame) return;
  setMasked(toggleMasked(masked, index));
  const cell = $spyBoard.children[index];
  if (cell) applyCellMask(cell, currentGame, index, masked[index]);
}

function render(game) {
  $spyBoard.replaceChildren();
  for (let i = 0; i < 25; i++) {
    const color = game.key[i];
    const cell = document.createElement('div');
    cell.className = 'key-cell spy-key-cell ' + color;
    cell.role = 'button';
    cell.tabIndex = 0;
    applyCellMask(cell, game, i, masked[i]);

    const mark = document.createElement('span');
    mark.className = 'team-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = COLOR_MARK[color];
    cell.appendChild(mark);

    appendWordStack(cell, game.words[i], 'key-word');

    cell.addEventListener('click', () => onToggle(i));
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggle(i);
      }
    });

    $spyBoard.appendChild(cell);
  }
  const counts = countKey(game.key);
  $spySub.textContent = `ทีมแดง ${counts.red} · ทีมน้ำเงิน ${counts.blue} · กลาง ${counts.neutral} · นักฆ่า ${counts.assassin}`;
  if ($clearMaskBtn) $clearMaskBtn.disabled = !masked.some(Boolean);
}

function showGame(game, code) {
  currentGame = game;
  currentCode = code;
  masked = loadMasked(sessionStorage, code);
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
    if (location.hash !== '#' + code) {
      history.replaceState(null, '', location.pathname + '#' + code);
    }
    showGame(game, code);
  } catch (e) {
    showImport('ไม่สามารถอ่านรหัสได้: ' + (e && e.message ? e.message : 'รูปแบบไม่ถูกต้อง'));
  }
}

const initial = location.hash.replace(/^#/, '').trim();
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
    clearSavedMasked(sessionStorage, currentCode);
    render(currentGame);
  });
}

window.addEventListener('hashchange', () => {
  const h = location.hash.replace(/^#/, '').trim();
  if (h) tryLoadFromCode(h);
});
