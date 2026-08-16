import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  MASK_STORAGE_PREFIX,
  clearMasked,
  clearSavedMasked,
  createMemoryStorage,
  emptyMasked,
  getSafeStorage,
  loadMasked,
  saveMasked,
  storageKey,
  toggleMasked,
} from '../spy-mask.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
    removeItem(k) {
      map.delete(k);
    },
  };
}

describe('spy-mask', () => {
  it('emptyMasked is 25 false', () => {
    const m = emptyMasked();
    assert.equal(m.length, BOARD_SIZE);
    assert.ok(m.every((v) => v === false));
  });

  it('toggleMasked flips one index immutably', () => {
    const a = emptyMasked();
    const b = toggleMasked(a, 3);
    assert.notEqual(a, b);
    assert.equal(a[3], false);
    assert.equal(b[3], true);
    const c = toggleMasked(b, 3);
    assert.equal(c[3], false);
  });

  it('toggleMasked ignores invalid index', () => {
    const a = emptyMasked();
    assert.equal(toggleMasked(a, -1), a);
    assert.equal(toggleMasked(a, 25), a);
    assert.equal(toggleMasked(a, 1.5), a);
    assert.equal(toggleMasked(null, 0), null);
  });

  it('clearMasked returns all false', () => {
    const m = emptyMasked();
    m[0] = true;
    m[10] = true;
    const cleared = clearMasked();
    assert.ok(cleared.every((v) => v === false));
  });

  it('storageKey prefixes the code', () => {
    assert.equal(storageKey('abc'), MASK_STORAGE_PREFIX + 'abc');
  });

  it('saveMasked and loadMasked round-trip', () => {
    const store = memoryStorage();
    const masked = emptyMasked();
    masked[2] = true;
    masked[24] = true;
    saveMasked(store, 'code1', masked);
    assert.deepEqual(loadMasked(store, 'code1'), masked);
  });

  it('loadMasked returns empty for missing or corrupt data', () => {
    const store = memoryStorage();
    assert.deepEqual(loadMasked(store, 'missing'), emptyMasked());
    store.setItem(storageKey('bad'), 'not-json');
    assert.deepEqual(loadMasked(store, 'bad'), emptyMasked());
    store.setItem(storageKey('short'), JSON.stringify([true, false]));
    assert.deepEqual(loadMasked(store, 'short'), emptyMasked());
    assert.deepEqual(loadMasked(null, 'x'), emptyMasked());
  });

  it('clearSavedMasked removes persisted entry', () => {
    const store = memoryStorage();
    const masked = emptyMasked();
    masked[1] = true;
    saveMasked(store, 'c', masked);
    clearSavedMasked(store, 'c');
    assert.deepEqual(loadMasked(store, 'c'), emptyMasked());
  });

  it('getSafeStorage falls back when storage throws', () => {
    const throwing = {
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
      getItem() { throw new Error('blocked'); },
    };
    const safe = getSafeStorage(throwing);
    const masked = emptyMasked();
    masked[4] = true;
    saveMasked(safe, 'x', masked);
    assert.deepEqual(loadMasked(safe, 'x'), masked);
  });

  it('createMemoryStorage round-trips independently', () => {
    const a = createMemoryStorage();
    const b = createMemoryStorage();
    a.setItem('k', '1');
    assert.equal(a.getItem('k'), '1');
    assert.equal(b.getItem('k'), null);
  });
});
