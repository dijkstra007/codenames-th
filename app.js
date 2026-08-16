import { THAI_WORDS, spokenLabel } from './words.js';
import { appendWordStack } from './word-ui.js';
import {
  COLOR_ARIA,
  COLOR_MARK,
  applyReveal,
  canUndo,
  countRemaining,
  createBoard,
  otherTeam,
  undoReveal,
} from './game.js';
import { encodeQr, qrToSvg } from './qr.js';
import { buildShareLink, encodeGame } from './share.js';

const STRICT_KEY = 'codenames-th-strict';

function loadStrict() {
  try {
    const v = localStorage.getItem(STRICT_KEY);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

function saveStrict(on) {
  try { localStorage.setItem(STRICT_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// --- Game + UI state ---
const ui = {
  flipped: false,
  strict: loadStrict(),
};
let state = createBoard(THAI_WORDS);
let shareLink = '';

// --- DOM refs ---
const $board         = document.getElementById('board');
const $keyGrid       = document.getElementById('keyGrid');
const $boardStage    = document.getElementById('boardStage');
const $keyBoard      = document.getElementById('keyBoard');
const $redLeft       = document.getElementById('redLeft');
const $blueLeft      = document.getElementById('blueLeft');
const $turnRedBtn    = document.getElementById('turnRedBtn');
const $turnBlueBtn   = document.getElementById('turnBlueBtn');
const $redStartTag   = document.getElementById('redStartTag');
const $blueStartTag  = document.getElementById('blueStartTag');
const $flipBtn       = document.getElementById('flipBtn');
const $flipLabel     = document.getElementById('flipLabel');
const $newGameBtn    = document.getElementById('newGameBtn');
const $overlayNewBtn   = document.getElementById('overlayNewBtn');
const $overlayCloseBtn = document.getElementById('overlayCloseBtn');
const $overlay         = document.getElementById('overlay');
const $overlayCard     = document.getElementById('overlayCard');
const $overlayTitle    = document.getElementById('overlayTitle');
const $overlaySub      = document.getElementById('overlaySub');
const $shareBtn      = document.getElementById('shareBtn');
const $shareOverlay  = document.getElementById('shareOverlay');
const $shareQr       = document.getElementById('shareQr');
const $shareQrHint   = document.getElementById('shareQrHint');
const $shareQrError  = document.getElementById('shareQrError');
const $shareCodeInput = document.getElementById('shareCodeInput');
const $copyLinkBtn   = document.getElementById('copyLinkBtn');
const $copyCodeBtn   = document.getElementById('copyCodeBtn');
const $shareCloseBtn = document.getElementById('shareCloseBtn');
const $startBanner   = document.getElementById('startBanner');
const $turnLive      = document.getElementById('turnLive');
const $clueInput     = document.getElementById('clueInput');
const $guessesInput  = document.getElementById('guessesInput');
const $undoBtn       = document.getElementById('undoBtn');
const $strictBtn     = document.getElementById('strictBtn');

// --- Dialogs ---
let activeDialog = null;
let flipTimer = 0;

function focusableIn(root) {
  return [...root.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((el) => !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true');
}

function openDialog(overlay) {
  const panel = overlay.querySelector('[role="dialog"]');
  const lastFocus = document.activeElement;
  overlay.hidden = false;
  activeDialog = { overlay, panel, lastFocus };
  const list = focusableIn(panel);
  const button = list.find((el) => el.tagName === 'BUTTON');
  (button || list[0] || panel).focus();
}

function closeDialog(overlay, { restore = true } = {}) {
  if (overlay.hidden) return;
  overlay.hidden = true;
  if (activeDialog && activeDialog.overlay === overlay) {
    const el = activeDialog.lastFocus;
    activeDialog = null;
    if (restore && el && typeof el.focus === 'function') el.focus();
  }
}

function parseGuesses() {
  const v = $guessesInput.value;
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clearClue() {
  $clueInput.value = '';
  $guessesInput.value = '';
}

function startBannerText(team) {
  return team === 'red' ? 'ทีมแดงเริ่มก่อน · 9 ใบ' : 'ทีมน้ำเงินเริ่มก่อน · 9 ใบ';
}

function turnLiveText() {
  const team = state.currentTurn === 'red' ? 'แดง' : 'น้ำเงิน';
  return 'เทิร์นทีม' + team;
}

function newGame() {
  state = createBoard(THAI_WORDS);
  ui.flipped = false;
  clearClue();
  closeDialog($shareOverlay, { restore: false });
  clearShare();
  closeDialog($overlay, { restore: false });
  $boardStage.classList.remove('flipped', 'flipping');
  $flipBtn.classList.remove('active');
  $flipBtn.setAttribute('aria-pressed', 'false');
  $flipLabel.textContent = 'ดูกุญแจสายลับ';
  $board.setAttribute('aria-hidden', 'false');
  $keyBoard.setAttribute('aria-hidden', 'true');
  renderBoard();
  renderKey();
  renderStatus();
}

function renderBoard() {
  $board.replaceChildren();
  for (let i = 0; i < 25; i++) {
    const c = document.createElement('div');
    c.className = 'card';
    c.dataset.index = String(i);
    c.setAttribute('role', 'button');

    appendWordStack(c, state.words[i], 'word');

    const mark = document.createElement('span');
    mark.className = 'team-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.hidden = true;
    c.appendChild(mark);

    applyCardVisual(c, i);
    attachCardHandlers(c, i);
    $board.appendChild(c);
  }
}

function applyCardVisual(cardEl, i) {
  cardEl.classList.remove('red', 'blue', 'neutral', 'assassin', 'revealed');
  const mark = cardEl.querySelector('.team-mark');
  const revealed = state.revealed[i];
  if (revealed) {
    const color = state.key[i];
    cardEl.classList.add('revealed', color);
    cardEl.tabIndex = -1;
    cardEl.setAttribute('aria-label', `${spokenLabel(state.words[i])} — ${COLOR_ARIA[color]} เปิดแล้ว`);
    if (mark) {
      mark.textContent = COLOR_MARK[color];
      mark.hidden = false;
    }
  } else {
    cardEl.tabIndex = ui.flipped ? -1 : 0;
    cardEl.setAttribute('aria-label', spokenLabel(state.words[i]));
    if (mark) {
      mark.textContent = '';
      mark.hidden = true;
    }
  }
}

function keyCellLabel(i) {
  const word = spokenLabel(state.words[i]);
  const team = COLOR_ARIA[state.key[i]] || '';
  if (state.revealed[i]) {
    const canUnmask = canUndo(state) && state.lastReveal?.index === i;
    return canUnmask
      ? `${word} · ${team} · เปิดแล้ว — แตะเพื่อเลิกทำ`
      : `${word} · ${team} · เปิดแล้ว`;
  }
  return `${word} · ${team} · ยังไม่เปิด — แตะเพื่อเปิด`;
}

function applyKeyCellVisual(cell, i) {
  const revealed = state.revealed[i];
  cell.classList.toggle('done', revealed);
  cell.setAttribute('aria-pressed', String(revealed));
  cell.setAttribute('aria-label', keyCellLabel(i));
  // Interactive while the key face is showing (or always focusable for a11y when flipped).
  cell.tabIndex = ui.flipped && !state.gameOver ? 0 : -1;
}

function attachKeyHandlers(cell, i) {
  cell.addEventListener('click', () => onKeyCellActivate(i));
  cell.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onKeyCellActivate(i);
    }
  });
}

function onKeyCellActivate(i) {
  if (!ui.flipped || state.gameOver) return;
  if (state.revealed[i]) {
    if (canUndo(state) && state.lastReveal?.index === i) undoLastReveal();
    return;
  }
  revealCard(i);
}

function renderKey() {
  $keyGrid.replaceChildren();
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    const color = state.key[i];
    cell.className = 'key-cell spy-key-cell ' + color;
    cell.setAttribute('role', 'button');

    const mark = document.createElement('span');
    mark.className = 'team-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = COLOR_MARK[color];
    cell.appendChild(mark);

    appendWordStack(cell, state.words[i], 'key-word');
    applyKeyCellVisual(cell, i);
    attachKeyHandlers(cell, i);

    $keyGrid.appendChild(cell);
  }
}

function renderStatus() {
  const left = countRemaining(state.key, state.revealed);
  $redLeft.textContent = left.red;
  $blueLeft.textContent = left.blue;

  $turnRedBtn.classList.toggle('active', state.currentTurn === 'red');
  $turnBlueBtn.classList.toggle('active', state.currentTurn === 'blue');
  $turnRedBtn.setAttribute('aria-pressed', String(state.currentTurn === 'red'));
  $turnBlueBtn.setAttribute('aria-pressed', String(state.currentTurn === 'blue'));

  $redStartTag.hidden = state.firstTeam !== 'red';
  $blueStartTag.hidden = state.firstTeam !== 'blue';

  $startBanner.textContent = startBannerText(state.firstTeam);
  $startBanner.className = 'start-banner ' + state.firstTeam;
  $turnLive.textContent = turnLiveText();

  $strictBtn.classList.toggle('active', ui.strict);
  $strictBtn.setAttribute('aria-pressed', String(ui.strict));

  $undoBtn.disabled = !canUndo(state);
}

function attachCardHandlers(cardEl, i) {
  cardEl.addEventListener('click', () => revealCard(i));
  cardEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      revealCard(i);
    }
  });
}

function revealCard(i) {
  // Allow reveal from the front board or from the flipped key (spy marks a guess).
  if (state.gameOver || state.revealed[i]) return;

  const guessesBefore = parseGuesses();
  const clueBefore = $clueInput.value;
  const result = applyReveal(state, i, { strict: ui.strict });
  if (!result.applied) return;

  state = result.state;
  if (state.lastReveal) {
    state.lastReveal = { ...state.lastReveal, guessesBefore, clueBefore };
  }

  const cardEl = $board.children[i];
  if (cardEl) {
    if (!prefersReducedMotion()) cardEl.classList.add('revealing');
    applyCardVisual(cardEl, i);
    window.setTimeout(() => cardEl.classList.remove('revealing'), 360);
  }

  const keyCell = $keyGrid.children[i];
  if (keyCell) applyKeyCellVisual(keyCell, i);

  if (result.color === state.lastReveal?.previousTurn && guessesBefore !== null && !state.gameOver) {
    const next = Math.max(0, guessesBefore - 1);
    $guessesInput.value = String(next);
    if (next === 0 && ui.strict) {
      state = { ...state, currentTurn: otherTeam(state.currentTurn) };
      state.lastReveal = { ...state.lastReveal, endedTurn: true };
    }
  }

  if (state.lastReveal?.endedTurn) clearClue();

  // Refresh key labels (undo affordance on the last reveal) and status.
  for (let k = 0; k < $keyGrid.children.length; k++) {
    applyKeyCellVisual($keyGrid.children[k], k);
  }
  renderStatus();

  if (state.gameOver) {
    showVictory(state.winner, result.reason);
  }
}

function showVictory(winner, reason) {
  $overlayCard.classList.remove('red', 'blue');
  $overlayCard.classList.add(winner);
  $overlayTitle.textContent = winner === 'red' ? 'ทีมแดงชนะ' : 'ทีมน้ำเงินชนะ';
  $overlaySub.textContent = reason || '';
  openDialog($overlay);
}

function setFlipped(on) {
  ui.flipped = on;
  $boardStage.classList.toggle('flipped', on);
  $flipBtn.classList.toggle('active', on);
  $flipBtn.setAttribute('aria-pressed', String(on));
  $flipLabel.textContent = on ? 'ซ่อนกุญแจ' : 'ดูกุญแจสายลับ';
  $board.setAttribute('aria-hidden', on ? 'true' : 'false');
  $keyBoard.setAttribute('aria-hidden', on ? 'false' : 'true');

  $boardStage.classList.add('flipping');
  window.clearTimeout(flipTimer);
  const ms = prefersReducedMotion() ? 0 : 700;
  flipTimer = window.setTimeout(() => $boardStage.classList.remove('flipping'), ms + 50);

  for (let i = 0; i < $board.children.length; i++) {
    applyCardVisual($board.children[i], i);
  }
  for (let i = 0; i < $keyGrid.children.length; i++) {
    applyKeyCellVisual($keyGrid.children[i], i);
  }
}

$flipBtn.addEventListener('click', () => setFlipped(!ui.flipped));

$turnRedBtn.addEventListener('click', () => {
  if (state.gameOver) return;
  if (state.currentTurn !== 'red') clearClue();
  state = { ...state, currentTurn: 'red' };
  renderStatus();
});
$turnBlueBtn.addEventListener('click', () => {
  if (state.gameOver) return;
  if (state.currentTurn !== 'blue') clearClue();
  state = { ...state, currentTurn: 'blue' };
  renderStatus();
});

$strictBtn.addEventListener('click', () => {
  ui.strict = !ui.strict;
  saveStrict(ui.strict);
  renderStatus();
});

function undoLastReveal() {
  if (!canUndo(state)) return;
  const snap = state.lastReveal;
  const index = snap.index;
  state = undoReveal(state);
  if (snap.clueBefore != null) $clueInput.value = snap.clueBefore;
  if (snap.guessesBefore == null) $guessesInput.value = '';
  else $guessesInput.value = String(snap.guessesBefore);

  const cardEl = $board.children[index];
  if (cardEl) applyCardVisual(cardEl, index);
  for (let k = 0; k < $keyGrid.children.length; k++) {
    applyKeyCellVisual($keyGrid.children[k], k);
  }
  renderStatus();
}

$undoBtn.addEventListener('click', undoLastReveal);

function startFresh() {
  newGame();
}
$newGameBtn.addEventListener('click', () => {
  if (!state.gameOver && state.revealed.some(Boolean)) {
    if (!confirm('เริ่มเกมใหม่? การเล่นปัจจุบันจะหายไป')) return;
  }
  startFresh();
});
$overlayNewBtn.addEventListener('click', startFresh);
$overlayCloseBtn.addEventListener('click', () => closeDialog($overlay));

function clearShare() {
  $shareQr.replaceChildren();
  $shareCodeInput.value = '';
  shareLink = '';
}

function renderShareQr(link) {
  $shareQr.replaceChildren();
  $shareQrError.hidden = true;
  $shareQrError.textContent = '';
  $shareQrHint.hidden = false;
  try {
    const svg = qrToSvg(encodeQr(link), { label: 'คิวอาร์โค้ดสำหรับสายลับ' });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const node = doc.documentElement;
    if (!node || node.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
      throw new Error('svg');
    }
    $shareQr.appendChild(document.importNode(node, true));
  } catch {
    $shareQrHint.hidden = true;
    $shareQrError.hidden = false;
    $shareQrError.textContent = 'สร้างคิวอาร์ไม่ได้ — ใช้ปุ่มคัดลอกลิงก์หรือรหัสด้านล่าง';
  }
}

function openShare() {
  const code = encodeGame(state);
  shareLink = buildShareLink(code, { origin: location.origin, pathname: location.pathname });
  $shareCodeInput.value = code;
  renderShareQr(shareLink);
  openDialog($shareOverlay);
}

function closeShare() {
  closeDialog($shareOverlay);
  clearShare();
}

async function copyText(text, btn) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
  }
  const orig = btn.textContent;
  btn.textContent = ok ? 'คัดลอกแล้ว ✓' : 'คัดลอกไม่ได้';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1400);
}

$shareBtn.addEventListener('click', openShare);
$shareCloseBtn.addEventListener('click', closeShare);
$shareOverlay.addEventListener('click', (e) => { if (e.target === $shareOverlay) closeShare(); });
$copyLinkBtn.addEventListener('click', () => { if (shareLink) copyText(shareLink, $copyLinkBtn); });
$copyCodeBtn.addEventListener('click', () => copyText($shareCodeInput.value, $copyCodeBtn));

$overlay.addEventListener('click', (e) => {
  if (e.target === $overlay) closeDialog($overlay);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && activeDialog && !activeDialog.overlay.hidden) {
    const list = focusableIn(activeDialog.panel);
    if (list.length === 0) {
      e.preventDefault();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
    return;
  }

  if (e.key !== 'Escape') return;
  if (!$shareOverlay.hidden) {
    closeShare();
    return;
  }
  if (!$overlay.hidden) {
    closeDialog($overlay);
    return;
  }
  if (ui.flipped) setFlipped(false);
});

newGame();
