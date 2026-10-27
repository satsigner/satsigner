import { createMMKV } from 'react-native-mmkv'
import { type StateStorage } from 'zustand/middleware'

import { isStringArray } from '@/utils/array'

const LAST_BACKGROUND_TIMESTAMP_KEY = 'lastBackgroundTimestamp'
const NOSTR_FOLLOW_CACHE_PREFIX = 'nostr:follows:'

const storage = createMMKV({ id: 'mmkv.satsigner' })

function nostrFollowCacheKey(npub: string): string {
  return `${NOSTR_FOLLOW_CACHE_PREFIX}${npub}`
}

function getNostrFollowCache(npub: string): string[] | null {
  const raw = storage.getString(nostrFollowCacheKey(npub))
  if (!raw) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStringArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function setNostrFollowCache(npub: string, pubkeys: string[]): void {
  storage.set(nostrFollowCacheKey(npub), JSON.stringify(pubkeys))
}

function clearNostrFollowCache(npub: string): void {
  storage.remove(nostrFollowCacheKey(npub))
}

function clearNostrFollowCaches(): void {
  for (const key of storage.getAllKeys()) {
    if (key.startsWith(NOSTR_FOLLOW_CACHE_PREFIX)) {
      storage.remove(key)
    }
  }
}

const mmkvStorage: StateStorage = {
  getItem: (name) => {
    const value = storage.getString(name)
    return value ?? null
  },
  removeItem: (name) => storage.remove(name),
  setItem: (name, value) => storage.set(name, value)
}

function setLastBackgroundTimestamp(timestamp: number) {
  storage.set(LAST_BACKGROUND_TIMESTAMP_KEY, timestamp)
}

function getLastBackgroundTimestamp() {
  return storage.getNumber(LAST_BACKGROUND_TIMESTAMP_KEY) ?? null
}

function clearAllStorage() {
  storage.clearAll()
}

const MMKV_PROBE_KEY = 'diagnostic:mmkv-probe'

type MmkvKeyStat = { bytes: number; key: string }

/** Byte size of every string value, largest first (diagnostics). */
function getMmkvKeyStats(): MmkvKeyStat[] {
  return storage
    .getAllKeys()
    .map((key) => ({ bytes: storage.getString(key)?.length ?? 0, key }))
    .toSorted((a, b) => b.bytes - a.bytes)
}

function listMmkvKeys(prefix: string): string[] {
  return storage.getAllKeys().filter((key) => key.startsWith(prefix))
}

/** Write → read → delete roundtrip on a throwaway key. */
function probeMmkvRoundtrip(): boolean {
  const value = `probe-${Date.now()}`
  storage.set(MMKV_PROBE_KEY, value)
  const roundtrip = storage.getString(MMKV_PROBE_KEY) === value
  storage.remove(MMKV_PROBE_KEY)
  return roundtrip && storage.getString(MMKV_PROBE_KEY) === undefined
}

export default mmkvStorage
export {
  clearAllStorage,
  clearNostrFollowCache,
  clearNostrFollowCaches,
  getLastBackgroundTimestamp,
  getMmkvKeyStats,
  getNostrFollowCache,
  listMmkvKeys,
  mmkvStorage,
  NOSTR_FOLLOW_CACHE_PREFIX,
  probeMmkvRoundtrip,
  setLastBackgroundTimestamp,
  setNostrFollowCache
}
export type { MmkvKeyStat }
