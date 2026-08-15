import { COLOR_MARK, countKey } from './game.js';
import { decodeGame, extractCode } from './share.js';
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
const $spySub       = document.getElementById('spySub');

function render(game) {
  $spyBoard.replaceChildren();
  for (let i = 0; i < 25; i++) {
    const color = game.key[i];
    const cell = document.createElement('div');
    cell.className = 'key-cell ' + color;

    const mark = document.createElement('span');
    mark.className = 'team-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = COLOR_MARK[color];
    cell.appendChild(mark);

    appendWordStack(cell, game.words[i], 'key-word');

    $spyBoard.appendChild(cell);
  }
  const counts = countKey(game.key);
  $spySub.textContent = `ทีมแดง ${counts.red} · ทีมน้ำเงิน ${counts.blue} · กลาง ${counts.neutral} · นักฆ่า ${counts.assassin}`;
}

function showGame(game) {
  $importScreen.hidden = true;
  $spyWarn.hidden = false;
  $spyMain.hidden = false;
  $spyControls.hidden = false;
  render(game);
}

function showImport(errMsg) {
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
    showGame(game);
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

window.addEventListener('hashchange', () => {
  const h = location.hash.replace(/^#/, '').trim();
  if (h) tryLoadFromCode(h);
});
