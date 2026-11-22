/**
 * Default save folder (CAP-9). The File System Access API is detected by feature, never by
 * browser. Only the directory handle is stored, in its own IndexedDB database; never a PDF.
 */
import { PREFS_DB_NAME } from './preferences-store.ts'

const STORE = 'handles'
const KEY = 'saveFolder'
const DB_VERSION = 2

export interface FolderHandle {
  readonly name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(data: Blob | BufferSource): Promise<void>; close(): Promise<void> }>
  }>
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<PermissionState>
}

type PickerHost = { showDirectoryPicker?: (options?: { mode?: 'readwrite' }) => Promise<FolderHandle> }

/** True when the browser offers a directory picker. */
export function supportsFolderPicker(host: object = globalThis): boolean {
  return typeof (host as PickerHost).showDirectoryPicker === 'function'
}

function open(create: boolean): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(PREFS_DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        if (!create) {
          // Reading must not leave an empty database behind.
          req.transaction?.abort()
          return
        }
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result ?? null)
      tx.onerror = tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** The stored folder handle, or null. Never throws and never creates the database. */
export async function loadFolder(): Promise<FolderHandle | null> {
  const db = await open(false)
  if (!db) return null
  try {
    if (!db.objectStoreNames.contains(STORE)) return null
    return (await request<FolderHandle>(db, 'readonly', (s) => s.get(KEY) as IDBRequest<FolderHandle>)) ?? null
  } finally {
    db.close()
  }
}

/** Asks the user for a folder and stores it. Null when cancelled, unsupported or storage fails. */
export async function pickFolder(host: object = globalThis): Promise<FolderHandle | null> {
  const picker = (host as PickerHost).showDirectoryPicker
  if (typeof picker !== 'function') return null
  let handle: FolderHandle
  try {
    handle = await picker.call(host, { mode: 'readwrite' })
  } catch {
    return null
  }
  const db = await open(true)
  if (!db) return null
  try {
    await request(db, 'readwrite', (s) => s.put(handle, KEY))
  } finally {
    db.close()
  }
  return handle
}

/** Forgets the stored folder; never throws. */
export async function clearFolder(): Promise<void> {
  const db = await open(false)
  if (!db) return
  try {
    if (db.objectStoreNames.contains(STORE)) await request(db, 'readwrite', (s) => s.delete(KEY))
  } finally {
    db.close()
  }
}

/**
 * Writes the PDF into the folder. Starts with the permission call so it runs inside the click.
 * Returns false (caller downloads instead) on denied permission or any failure.
 */
export async function writePdfToFolder(handle: FolderHandle, bytes: Uint8Array, fileName: string): Promise<boolean> {
  try {
    const mode = { mode: 'readwrite' } as const
    let state = (await handle.queryPermission?.(mode)) ?? 'granted'
    if (state !== 'granted') state = (await handle.requestPermission?.(mode)) ?? 'denied'
    if (state !== 'granted') return false
    const file = await handle.getFileHandle(fileName, { create: true })
    const writable = await file.createWritable()
    await writable.write(bytes as unknown as BufferSource)
    await writable.close()
    return true
  } catch {
    return false
  }
}
