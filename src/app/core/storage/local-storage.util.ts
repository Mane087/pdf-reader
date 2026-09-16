/** Reads and parses a JSON value. Returns `null` when the key is missing, the JSON is invalid or `localStorage` is unavailable. */
export function readJsonFromLocalStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

/** Serializes and stores a value. Skips the write when the stored value is already identical. Never throws. */
export function writeJsonToLocalStorage(key: string, value: unknown): void {
  try {
    const raw = JSON.stringify(value);
    if (localStorage.getItem(key) !== raw) {
      localStorage.setItem(key, raw);
    }
  } catch {
    // localStorage unavailable or quota exceeded: preferences stay in memory.
  }
}
