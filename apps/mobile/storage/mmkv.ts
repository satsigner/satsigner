import { MMKV } from 'react-native-mmkv'
import { type StateStorage } from 'zustand/middleware'

const LAST_BACKGROUND_TIMESTAMP_KEY = 'lastBackgroundTimestamp'

const storage = new MMKV({ id: 'mmkv.satsigner' })

const mmkvStorage: StateStorage = {
  setItem: (name, value) => {
    return storage.set(name, value)
  },
  getItem: (name) => {
    const value = storage.getString(name)
    return value ?? null
  },
  removeItem: (name) => {
    return storage.delete(name)
  }
}

function setLastBackgroundTimestamp(timestamp: number) {
  storage.set(LAST_BACKGROUND_TIMESTAMP_KEY, timestamp)
}

function getLastBackgroundTimestamp() {
  return storage.getNumber(LAST_BACKGROUND_TIMESTAMP_KEY) ?? null
}

export default mmkvStorage
export { getLastBackgroundTimestamp, mmkvStorage, setLastBackgroundTimestamp }
