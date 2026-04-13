import { createMMKV } from 'react-native-mmkv'
import { type StateStorage } from 'zustand/middleware'

const LAST_BACKGROUND_TIMESTAMP_KEY = 'lastBackgroundTimestamp'

const storage = createMMKV({ id: 'mmkv.satsigner' })

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
  getLastBackgroundTimestamp,
  mmkvStorage,
  setLastBackgroundTimestamp
}
