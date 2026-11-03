import { createMMKV } from 'react-native-mmkv'

import { DEV_CONSOLE_PERSISTED_SLOTS } from '@/constants/devConsole'
import type { DevConsoleEntry } from '@/types/models/DevConsole'
import { isRecord } from '@/utils/object'

const storage = createMMKV({ id: 'mmkv.devconsole' })

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
  return storage
    .getAllKeys()
    .filter((key) => key.startsWith(CURRENT_SLOT_PREFIX))
    .map((key) => parseEntry(storage.getString(key)))
    .filter((entry) => entry !== null)
    .toSorted((left, right) => left.id - right.id)
}

export function persistDevConsoleEntry(entry: DevConsoleEntry): void {
  storage.set(slotKey(entry.id), JSON.stringify(entry))
}

/**
 * Moves the last run's entries aside as the previous session and starts an
 * empty current one. Call once per app launch.
 */
export function rotateDevConsoleSession(): DevConsoleEntry[] {
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
  const raw = storage.getString(PREVIOUS_SESSION_KEY)
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
  storage.clearAll()
}
