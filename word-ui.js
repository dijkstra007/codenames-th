import { englishFor } from './words.js';

export function appendWordStack(parent, thai, wordClass) {
  const stack = document.createElement('span');
  stack.className = 'word-stack';

  const word = document.createElement('span');
  word.className = wordClass;
  word.textContent = thai;
  stack.appendChild(word);

  const en = englishFor(thai);
  if (en) {
    const gloss = document.createElement('span');
    gloss.className = 'word-en';
    gloss.lang = 'en';
    gloss.textContent = en;
    stack.appendChild(gloss);
  }
  parent.appendChild(stack);
}
