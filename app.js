import { THAI_WORDS } from './words.js';

// --- Game state ---
const state = {
  words: [],         // 25 words
  key: [],           // 25 colors: 'red' | 'blue' | 'neutral' | 'assassin'
  revealed: [],      // 25 booleans
  firstTeam: 'red',  // who has 9 cards
  currentTurn: 'red',
  gameOver: false,
  winner: null,
  flipped: false,
};

// --- DOM refs ---
const $board        = document.getElementById('board');
const $keyGrid      = document.getElementById('keyGrid');
const $boardStage   = document.getElementById('boardStage');
const $redLeft      = document.getElementById('redLeft');
const $blueLeft     = document.getElementById('blueLeft');
const $turnRedBtn   = document.getElementById('turnRedBtn');
const $turnBlueBtn  = document.getElementById('turnBlueBtn');
const $flipBtn      = document.getElementById('flipBtn');
const $flipLabel    = document.getElementById('flipLabel');
const $newGameBtn   = document.getElementById('newGameBtn');
const $overlayNewBtn = document.getElementById('overlayNewBtn');
const $overlay      = document.getElementById('overlay');
const $overlayCard  = document.getElementById('overlayCard');
const $overlayTitle = document.getElementById('overlayTitle');
const $overlaySub   = document.getElementById('overlaySub');

// --- Helpers ---
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newGame() {
  state.words = shuffle(THAI_WORDS).slice(0, 25);

  state.firstTeam   = Math.random() < 0.5 ? 'red' : 'blue';
  state.currentTurn = state.firstTeam;
  const secondTeam  = state.firstTeam === 'red' ? 'blue' : 'red';

  const colors = [];
  for (let i = 0; i < 9; i++) colors.push(state.firstTeam);
  for (let i = 0; i < 8; i++) colors.push(secondTeam);
  for (let i = 0; i < 7; i++) colors.push('neutral');
  colors.push('assassin');
  state.key = shuffle(colors);

  state.revealed = Array(25).fill(false);
  state.gameOver = false;
  state.winner = null;

  // Auto-hide key on new game so spymaster can reveal fresh
  setFlipped(false);

  $overlay.hidden = true;
  renderBoard();
  renderKey();
  renderStatus();
}

function renderBoard() {
  $board.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const c = document.createElement('div');
    c.className = 'card';
    c.dataset.index = i;
    c.setAttribute('role', 'button');
    c.setAttribute('tabindex', '0');
    c.setAttribute('aria-label', state.words[i]);

    const word = document.createElement('span');
    word.className = 'word';
    word.textContent = state.words[i];
    c.appendChild(word);

    applyCardVisual(c, i);
    attachCardHandlers(c, i);
    $board.appendChild(c);
  }
}

function applyCardVisual(cardEl, i) {
  cardEl.classList.remove('red','blue','neutral','assassin','revealed');
  if (state.revealed[i]) {
    cardEl.classList.add('revealed', state.key[i]);
  }
}

function renderKey() {
  $keyGrid.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'key-cell ' + state.key[i];
    if (state.revealed[i]) cell.classList.add('done');
    cell.textContent = state.words[i];
    $keyGrid.appendChild(cell);
  }
}

function renderStatus() {
  // Remaining counts
  let redLeft = 0, blueLeft = 0;
  for (let i = 0; i < 25; i++) {
    if (state.revealed[i]) continue;
    if (state.key[i] === 'red')  redLeft++;
    if (state.key[i] === 'blue') blueLeft++;
  }
  $redLeft.textContent  = redLeft;
  $blueLeft.textContent = blueLeft;

  // Turn highlight
  $turnRedBtn.classList.toggle('active',  state.currentTurn === 'red');
  $turnBlueBtn.classList.toggle('active', state.currentTurn === 'blue');
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
  if (state.gameOver || state.revealed[i]) return;
  // Prevent revealing while the board is flipped (key side is visible)
  if (state.flipped) return;

  state.revealed[i] = true;
  const cardEl = $board.children[i];
  cardEl.classList.add('revealing');
  applyCardVisual(cardEl, i);
  setTimeout(() => cardEl.classList.remove('revealing'), 400);

  const color = state.key[i];

  if (color === 'assassin') {
    const loser  = state.currentTurn;
    const winner = loser === 'red' ? 'blue' : 'red';
    endGame(winner, 'ทีม' + (loser === 'red' ? 'แดง' : 'น้ำเงิน') + 'แตะนักฆ่า — แพ้ทันที');
  } else {
    const redDone  = state.key.every((c, idx) => c !== 'red'  || state.revealed[idx]);
    const blueDone = state.key.every((c, idx) => c !== 'blue' || state.revealed[idx]);
    if (redDone)       endGame('red',  'ทีมแดงเปิดการ์ดครบแล้ว');
    else if (blueDone) endGame('blue', 'ทีมน้ำเงินเปิดการ์ดครบแล้ว');
    // NOTE: Turn does NOT auto-switch — users toggle manually
  }

  renderKey();
  renderStatus();
}

function endGame(winner, reason) {
  state.gameOver = true;
  state.winner = winner;
  $overlayCard.classList.remove('red','blue');
  $overlayCard.classList.add(winner);
  $overlayTitle.textContent = winner === 'red' ? 'ทีมแดงชนะ' : 'ทีมน้ำเงินชนะ';
  $overlaySub.textContent   = reason || '';
  $overlay.hidden = false;
}

// --- Flip control ---
function setFlipped(on) {
  state.flipped = on;
  $boardStage.classList.toggle('flipped', on);
  $flipBtn.classList.toggle('active', on);
  $flipLabel.textContent = on ? 'ซ่อนกุญแจ' : 'ดูกุญแจสายลับ';
  $board.setAttribute('aria-hidden', on ? 'true' : 'false');
  document.getElementById('keyBoard').setAttribute('aria-hidden', on ? 'false' : 'true');
}

$flipBtn.addEventListener('click', () => setFlipped(!state.flipped));
// Esc to quickly hide the key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.flipped) setFlipped(false);
});

// --- Turn buttons ---
$turnRedBtn.addEventListener('click', () => {
  if (state.gameOver) return;
  state.currentTurn = 'red';
  renderStatus();
});
$turnBlueBtn.addEventListener('click', () => {
  if (state.gameOver) return;
  state.currentTurn = 'blue';
  renderStatus();
});

// --- New Game ---
function startFresh() {
  newGame();
}
$newGameBtn.addEventListener('click', () => {
  if (!state.gameOver && state.revealed.some(r => r)) {
    if (!confirm('เริ่มเกมใหม่? การเล่นปัจจุบันจะหายไป')) return;
  }
  startFresh();
});
$overlayNewBtn.addEventListener('click', startFresh);

// --- Boot ---
newGame();
