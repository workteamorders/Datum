// localStorage that never throws. Every caller must work when it returns null or false.

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** True when this browser lets the page keep a small value. */
export function storageWorks(): boolean {
  const k = "datum.probe";
  if (!writeStored(k, "1")) return false;
  try {
    window.localStorage.removeItem(k);
  } catch {
    /* the write worked, so this is enough */
  }
  return true;
}
