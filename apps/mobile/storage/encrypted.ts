import * as SecureStore from 'expo-secure-store'

const VERSION = '1'

/**
 * Store an item in the SharedPreferences (android) or Keychain (iOS)
 * @param {string} key The key by which to do a lookup
 * @param {string} value The value to be stored
 * @returns {Promise<void>}
 */
async function setItem(key: string, value: string): Promise<void> {
  const vKey = `${VERSION}_${key}`
  await SecureStore.setItemAsync(vKey, value)
}

/**
 * Read an item stored in the SharedPreferences (android) or Keychain (iOS)
 * @param {string} key The key by which to do a lookup
 * @returns {Promise<string | null>} The stored value
 */
async function getItem(key: string): Promise<string | null> {
  const vKey = `${VERSION}_${key}`
  return SecureStore.getItemAsync(vKey)
}

/**
 * Delete an item sotred in the SharedPreferences (android) or Keychain (iOS)
 * @param {string} key The key that was used to store the associated value
 * @returns {Promise<void>} A promise that will reject if the value couldn't be deleted
 */
async function deleteItem(key: string): Promise<void> {
  const vKey = `${VERSION}_${key}`
  return SecureStore.deleteItemAsync(vKey)
}

export { deleteItem, getItem, setItem }
