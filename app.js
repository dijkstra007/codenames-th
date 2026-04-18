import { THAI_WORDS } from './words.js';

// --- Game state ---
const state = {
  words: [],      // 25 words
  key: [],        // 25 colors: 'red' | 'blue' | 'neutral' | 'assassin'
  revealed: [],   // 25 booleans
  markers: [],    // 25 strings: '' | 'red' | 'blue' | 'neutral' | 'assassin'
  firstTeam: 'red',
  currentTurn: 'red',
  gameOver: false,
  winner: null,
};

// --- DOM refs ---
const $board     = document.getElementById('board');
const $keyGrid   = document.getElementById('keyGrid');
const $keyPanel  = document.getElementById('keyPanel');
const $keyToggle = document.getElementById('keyToggle');
const $keyToggleLabel = document.getElementById('keyToggleLabel');
const $keyContent = document.getElementById('keyContent');
const $turnStatus = document.getElementById('turnStatus');
const $turnDot    = document.getElementById('turnDot');
const $turnLabel  = document.getElementById('turnLabel');
const $redLeft    = document.getElementById('redLeft');
const $blueLeft   = document.getElementById('blueLeft');
const $keyRedTotal  = document.getElementById('keyRedTotal');
const $keyBlueTotal = document.getElementById('keyBlueTotal');
const $newGameBtn = document.getElementById('newGameBtn');
const $overlayNewBtn = document.getElementById('overlayNewBtn');
const $switchTurnBtn = document.getElementById('switchTurnBtn');
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
  // Pick 25 unique words
  state.words = shuffle(THAI_WORDS).slice(0, 25);

  // Pick first team (random), 9 for first, 8 for second, 7 neutral, 1 assassin
  state.firstTeam   = Math.random() < 0.5 ? 'red' : 'blue';
  state.currentTurn = state.firstTeam;
  const firstCount  = 9;
  const secondCount = 8;
  const secondTeam  = state.firstTeam === 'red' ? 'blue' : 'red';

  const colors = [];
  for (let i = 0; i < firstCount; i++)  colors.push(state.firstTeam);
  for (let i = 0; i < secondCount; i++) colors.push(secondTeam);
  for (let i = 0; i < 7; i++)           colors.push('neutral');
  colors.push('assassin');
  state.key = shuffle(colors);

  state.revealed = Array(25).fill(false);
  state.markers  = Array(25).fill('');
  state.gameOver = false;
  state.winner = null;

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

    const marker = document.createElement('span');
    marker.className = 'marker';
    c.appendChild(marker);

    applyCardVisual(c, i);
    attachCardHandlers(c, i);
    $board.appendChild(c);
  }
}

function applyCardVisual(cardEl, i) {
  cardEl.classList.remove('red','blue','neutral','assassin','revealed','marked','drag-over');
  if (state.revealed[i]) {
    cardEl.classList.add('revealed', state.key[i]);
  } else if (state.markers[i]) {
    cardEl.classList.add('marked');
    const marker = cardEl.querySelector('.marker');
    marker.className = 'marker ' + state.markers[i];
  } else {
    const marker = cardEl.querySelector('.marker');
    marker.className = 'marker';
  }
}

function renderKey() {
  $keyGrid.innerHTML = '';
  const firstTeam  = state.firstTeam;
  const secondTeam = firstTeam === 'red' ? 'blue' : 'red';
  $keyRedTotal.textContent  = firstTeam  === 'red'  ? '9' : '8';
  $keyBlueTotal.textContent = firstTeam  === 'blue' ? '9' : '8';

  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'key-cell ' + state.key[i];
    if (state.revealed[i]) cell.classList.add('done');
    cell.textContent = state.words[i];
    $keyGrid.appendChild(cell);
  }
}

function renderStatus() {
  // Count remaining for each team
  let redLeft = 0, blueLeft = 0;
  for (let i = 0; i < 25; i++) {
    if (state.revealed[i]) continue;
    if (state.key[i] === 'red')  redLeft++;
    if (state.key[i] === 'blue') blueLeft++;
  }
  $redLeft.textContent  = redLeft;
  $blueLeft.textContent = blueLeft;

  // Turn indicator
  $turnStatus.classList.remove('red','blue');
  if (state.gameOver) {
    $turnLabel.textContent = state.winner === 'red' ? 'ทีมแดงชนะ' : 'ทีมน้ำเงินชนะ';
    $turnStatus.classList.add(state.winner);
  } else {
    $turnStatus.classList.add(state.currentTurn);
    $turnLabel.textContent = state.currentTurn === 'red' ? 'ตาทีมแดง' : 'ตาทีมน้ำเงิน';
  }
}

// --- Card interaction ---
function attachCardHandlers(cardEl, i) {
  // Tap / click to reveal
  cardEl.addEventListener('click', (e) => {
    // Ignore clicks during drag-drop
    if (cardEl.dataset.justDropped === '1') {
      cardEl.dataset.justDropped = '0';
      return;
    }
    revealCard(i);
  });

  // Keyboard
  cardEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      revealCard(i);
    }
  });

  // Native drag & drop (desktop)
  cardEl.addEventListener('dragover', (e) => {
    if (state.revealed[i] || state.gameOver) return;
    e.preventDefault();
    cardEl.classList.add('drag-over');
  });
  cardEl.addEventListener('dragleave', () => {
    cardEl.classList.remove('drag-over');
  });
  cardEl.addEventListener('drop', (e) => {
    e.preventDefault();
    cardEl.classList.remove('drag-over');
    const color = e.dataTransfer.getData('text/color');
    if (color) {
      applyMarker(i, color);
      cardEl.dataset.justDropped = '1';
    }
  });
}

function revealCard(i) {
  if (state.gameOver || state.revealed[i]) return;
  state.revealed[i] = true;
  state.markers[i] = ''; // clear marker when revealed
  const cardEl = $board.children[i];
  cardEl.classList.add('revealing');
  applyCardVisual(cardEl, i);
  setTimeout(() => cardEl.classList.remove('revealing'), 400);

  const color = state.key[i];

  // End-of-game checks
  if (color === 'assassin') {
    const winner = state.currentTurn === 'red' ? 'blue' : 'red';
    endGame(winner, 'แตะนักฆ่า — ทีม' + (state.currentTurn === 'red' ? 'แดง' : 'น้ำเงิน') + 'แพ้ทันที');
  } else {
    // Check if all of a team's cards are revealed
    const redDone  = state.key.every((c, idx) => c !== 'red'  || state.revealed[idx]);
    const blueDone = state.key.every((c, idx) => c !== 'blue' || state.revealed[idx]);
    if (redDone)  endGame('red',  'ทีมแดงเปิดการ์ดครบแล้ว');
    else if (blueDone) endGame('blue', 'ทีมน้ำเงินเปิดการ์ดครบแล้ว');
    else if (color !== state.currentTurn) {
      // Wrong team / neutral → switch turn
      state.currentTurn = state.currentTurn === 'red' ? 'blue' : 'red';
    }
  }

  renderKey();
  renderStatus();
}

function applyMarker(i, color) {
  if (state.revealed[i] || state.gameOver) return;
  if (color === 'erase') {
    state.markers[i] = '';
  } else {
    state.markers[i] = color;
  }
  applyCardVisual($board.children[i], i);
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

// --- Drag source (palette chips) ---
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/color', chip.dataset.color);
    e.dataTransfer.effectAllowed = 'copy';
  });
});

// --- Touch drag & drop (mobile) ---
// Native HTML5 drag doesn't work on touch. Implement a simple pointer-based fallback.
let touchDragColor = null;
let touchGhost = null;

function setupTouchDrag() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('touchstart', (e) => {
      touchDragColor = chip.dataset.color;
      // Create ghost element
      touchGhost = chip.cloneNode(true);
      touchGhost.style.position = 'fixed';
      touchGhost.style.pointerEvents = 'none';
      touchGhost.style.zIndex = '1000';
      touchGhost.style.opacity = '0.85';
      touchGhost.style.transform = 'scale(1.1)';
      touchGhost.style.boxShadow = '0 8px 24px rgba(0,0,0,.5)';
      document.body.appendChild(touchGhost);
      moveGhost(e.touches[0]);
    }, { passive: true });

    chip.addEventListener('touchmove', (e) => {
      if (!touchGhost) return;
      e.preventDefault();
      moveGhost(e.touches[0]);
      // highlight card under finger
      const t = e.touches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      $board.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
      const card = el?.closest('.card');
      if (card && !card.classList.contains('revealed')) card.classList.add('drag-over');
    }, { passive: false });

    chip.addEventListener('touchend', (e) => {
      if (!touchGhost) return;
      const t = e.changedTouches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const card = el?.closest('.card');
      if (card && touchDragColor) {
        const i = Number(card.dataset.index);
        applyMarker(i, touchDragColor);
        card.dataset.justDropped = '1';
      }
      $board.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
      touchGhost.remove();
      touchGhost = null;
      touchDragColor = null;
    });

    chip.addEventListener('touchcancel', () => {
      if (touchGhost) { touchGhost.remove(); touchGhost = null; }
      touchDragColor = null;
      $board.querySelectorAll('.card.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
  });
}

function moveGhost(touch) {
  if (!touchGhost) return;
  touchGhost.style.left = (touch.clientX - 40) + 'px';
  touchGhost.style.top  = (touch.clientY - 20) + 'px';
}

// --- Key panel toggle ---
$keyToggle.addEventListener('click', () => {
  const open = $keyPanel.classList.toggle('open');
  $keyToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  $keyContent.setAttribute('aria-hidden', open ? 'false' : 'true');
  $keyToggleLabel.textContent = open ? 'ซ่อนกุญแจสายลับ' : 'แสดงกุญแจสายลับ';
});

// Auto-close key panel on Escape for quick hiding
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $keyPanel.classList.contains('open')) {
    $keyPanel.classList.remove('open');
    $keyToggle.setAttribute('aria-expanded', 'false');
    $keyContent.setAttribute('aria-hidden', 'true');
    $keyToggleLabel.textContent = 'แสดงกุญแจสายลับ';
  }
});

// --- Buttons ---
$newGameBtn.addEventListener('click', () => {
  if (!state.gameOver && state.revealed.some(r => r)) {
    if (!confirm('เริ่มเกมใหม่? การเล่นปัจจุบันจะหายไป')) return;
  }
  newGame();
  // Auto-close key after new game so spymaster reopens
  $keyPanel.classList.remove('open');
  $keyToggle.setAttribute('aria-expanded', 'false');
  $keyContent.setAttribute('aria-hidden', 'true');
  $keyToggleLabel.textContent = 'แสดงกุญแจสายลับ';
});

$overlayNewBtn.addEventListener('click', () => {
  newGame();
  $keyPanel.classList.remove('open');
  $keyToggle.setAttribute('aria-expanded', 'false');
  $keyContent.setAttribute('aria-hidden', 'true');
  $keyToggleLabel.textContent = 'แสดงกุญแจสายลับ';
});

$switchTurnBtn.addEventListener('click', () => {
  if (state.gameOver) return;
  state.currentTurn = state.currentTurn === 'red' ? 'blue' : 'red';
  renderStatus();
});

// --- Boot ---
newGame();
setupTouchDrag();
