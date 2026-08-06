import { createMMKV } from 'react-native-mmkv'
import { type StateStorage } from 'zustand/middleware'

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
    return JSON.parse(raw) as string[]
  } catch {
    return null
  }
}

function setNostrFollowCache(npub: string, pubkeys: string[]): void {
  storage.set(nostrFollowCacheKey(npub), JSON.stringify(pubkeys))
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

export default mmkvStorage
export {
  clearAllStorage,
  clearNostrFollowCaches,
  getLastBackgroundTimestamp,
  getNostrFollowCache,
  mmkvStorage,
  setLastBackgroundTimestamp,
  setNostrFollowCache
}
