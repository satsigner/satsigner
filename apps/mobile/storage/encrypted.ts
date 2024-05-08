import * as SecureStore from 'expo-secure-store'

const VERSION = '1'

/**
 * Store an item in the SharedPreferences (android) or Keychain (iOS)
 * @param {string} key The key by which to do a lookup
 * @param {string }value The value to be stored
 * @returns {Promise<void>}
 */
async function setItem(key: string, value: string) {
  const vKey = `${VERSION}_${key}`
  await SecureStore.setItemAsync(vKey, value)
}

/**
 * Read an item stored in the SharedPreferences (android) or Keychain (iOS)
 * @param {string} key The key by which to do a lookup
 * @returns {Promise<string | null>} The stored value
 */
async function getItem(key: string) {
  const vKey = `${VERSION}_${key}`
  return SecureStore.getItemAsync(vKey)
}

export { getItem, setItem }
