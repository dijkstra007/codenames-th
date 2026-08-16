/** Pure helpers for spymaster guessed-word masking. Safe for Node tests. */

export const BOARD_SIZE = 25;
export const MASK_STORAGE_PREFIX = 'codenames-th-spy-masked:';

export function emptyMasked() {
  return Array(BOARD_SIZE).fill(false);
}

export function storageKey(code) {
  return MASK_STORAGE_PREFIX + code;
}

/**
 * Toggle one cell. Returns a new array (does not mutate).
 * Invalid index returns the same array reference.
 */
export function toggleMasked(masked, index) {
  if (
    !Array.isArray(masked) ||
    masked.length !== BOARD_SIZE ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= BOARD_SIZE
  ) {
    return masked;
  }
  const next = masked.slice();
  next[index] = !next[index];
  return next;
}

export function clearMasked() {
  return emptyMasked();
}

/** Load a 25-boolean mask from storage-like object. Corrupt → empty. */
export function loadMasked(storage, code) {
  if (!storage || !code) return emptyMasked();
  try {
    const raw = storage.getItem(storageKey(code));
    if (raw == null) return emptyMasked();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== BOARD_SIZE) return emptyMasked();
    return parsed.map((v) => Boolean(v));
  } catch {
    return emptyMasked();
  }
}

/** Persist mask; ignore storage failures. */
export function saveMasked(storage, code, masked) {
  if (!storage || !code || !Array.isArray(masked) || masked.length !== BOARD_SIZE) return;
  try {
    storage.setItem(storageKey(code), JSON.stringify(masked.map((v) => Boolean(v))));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Remove persisted mask for a code. */
export function clearSavedMasked(storage, code) {
  if (!storage || !code) return;
  try {
    storage.removeItem(storageKey(code));
  } catch {
    /* ignore */
  }
}
