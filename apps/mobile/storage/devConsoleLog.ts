import * as SecureStore from 'expo-secure-store'
import { createMMKV, type MMKV } from 'react-native-mmkv'
import QuickCrypto from 'react-native-quick-crypto'

import { DEV_CONSOLE_PERSISTED_SLOTS } from '@/constants/devConsole'
import type { DevConsoleEntry } from '@/types/models/DevConsole'
import { isRecord } from '@/utils/object'

const STORAGE_ID = 'mmkv.devconsole'
export const DEV_CONSOLE_LOG_KEY_STORE_KEY = 'dev_console_log_key'
// MMKV's AES-256 takes at most 32 key bytes: 16 random bytes as hex.
const ENCRYPTION_KEY_BYTES = 16

const opened: { storage: MMKV | null } = { storage: null }

function createEncryptionKey(): string {
  const key = Buffer.from(
    QuickCrypto.randomBytes(ENCRYPTION_KEY_BYTES)
  ).toString('hex')
  SecureStore.setItem(DEV_CONSOLE_LOG_KEY_STORE_KEY, key)
  return key
}

/**
 * Opened on first use so production builds, which never log, never touch the
 * keychain. The key lives in secure storage, so the log file is unreadable
 * on its own.
 */
function getStorage(): MMKV {
  if (opened.storage) {
    return opened.storage
  }
  const storedKey = SecureStore.getItem(DEV_CONSOLE_LOG_KEY_STORE_KEY)
  const storage = createMMKV({
    encryptionKey: storedKey ?? createEncryptionKey(),
    encryptionType: 'AES-256',
    id: STORAGE_ID
  })
  if (!storedKey) {
    // Whatever is on disk was written without this key: drop it.
    storage.clearAll()
  }
  opened.storage = storage
  return storage
}

const CURRENT_SLOT_PREFIX = 'current:'
const PREVIOUS_SESSION_KEY = 'previous'

// One key per slot: each entry costs a single small synchronous write, even
// when a loop floods the log.
function slotKey(id: number): string {
  return `${CURRENT_SLOT_PREFIX}${id % DEV_CONSOLE_PERSISTED_SLOTS}`
}

function isEntry(value: unknown): value is DevConsoleEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.time === 'number' &&
    typeof value.level === 'string' &&
    typeof value.scope === 'string' &&
    typeof value.message === 'string'
  )
}

function parseEntry(raw: string | undefined): DevConsoleEntry | null {
  if (!raw) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isEntry(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readCurrentSession(): DevConsoleEntry[] {
  const storage = getStorage()
  return storage
    .getAllKeys()
    .filter((key) => key.startsWith(CURRENT_SLOT_PREFIX))
    .map((key) => parseEntry(storage.getString(key)))
    .filter((entry) => entry !== null)
    .toSorted((left, right) => left.id - right.id)
}

export function persistDevConsoleEntry(entry: DevConsoleEntry): void {
  getStorage().set(slotKey(entry.id), JSON.stringify(entry))
}

/**
 * Moves the last run's entries aside as the previous session and starts an
 * empty current one. Call once per app launch.
 */
export function rotateDevConsoleSession(): DevConsoleEntry[] {
  const storage = getStorage()
  const previous = readCurrentSession()
  for (const key of storage.getAllKeys()) {
    if (key.startsWith(CURRENT_SLOT_PREFIX)) {
      storage.remove(key)
    }
  }
  if (previous.length > 0) {
    storage.set(PREVIOUS_SESSION_KEY, JSON.stringify(previous))
    return previous
  }
  return readPreviousDevConsoleSession()
}

export function readPreviousDevConsoleSession(): DevConsoleEntry[] {
  const raw = getStorage().getString(PREVIOUS_SESSION_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isEntry) : []
  } catch {
    return []
  }
}

export function clearDevConsoleStorage(): void {
  getStorage().clearAll()
}
