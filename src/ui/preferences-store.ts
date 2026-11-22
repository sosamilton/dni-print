import { DEFAULT_PREFS, parsePrefs, PREFS_KEY, serializePrefs, type Prefs } from './preferences.ts'

/** Name reserved for the folder-handle database of story 9-7. */
export const PREFS_DB_NAME = 'dni-print-prefs'

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Saved preferences, validated; the defaults when nothing is saved or storage is unavailable. */
export function readPrefs(): Prefs {
  try {
    return parsePrefs(storage()?.getItem(PREFS_KEY))
  } catch {
    return DEFAULT_PREFS
  }
}

/** Writes the preferences; when every value is the default the key is removed. Never throws. */
export function savePrefs(prefs: Prefs): void {
  try {
    const s = storage()
    if (!s) return
    const value = serializePrefs(prefs)
    if (value === null) s.removeItem(PREFS_KEY)
    else s.setItem(PREFS_KEY, value)
  } catch {
    // Storage unavailable or full: the preferences simply do not persist.
  }
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = req.onerror = () => resolve()
      // A blocked delete stays pending; never hang the caller.
      setTimeout(resolve, 2000)
    } catch {
      resolve()
    }
  })
}

/** Removes the preferences key and every IndexedDB database of the app. Never throws. */
export async function clearAllPrefs(): Promise<void> {
  try {
    storage()?.removeItem(PREFS_KEY)
  } catch {
    // Nothing to remove.
  }
  try {
    const names = new Set<string>([PREFS_DB_NAME])
    try {
      for (const db of (await indexedDB.databases?.()) ?? []) if (db.name) names.add(db.name)
    } catch {
      // databases() is not available everywhere.
    }
    await Promise.all([...names].map(deleteDb))
  } catch {
    // IndexedDB unavailable: nothing stored there.
  }
}
