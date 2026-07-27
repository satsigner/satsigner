import * as SecureStore from 'expo-secure-store'

const VERSION = '1'
const KEY_SECRET_PREFIX = 'key_secret'
const KEY_IV_PREFIX = 'key_iv'
const ECASH_MNEMONIC_PREFIX = 'ecash_mnemonic'
const ARK_MNEMONIC_PREFIX = 'ark_mnemonic'

/**
 * Store an item in the SharedPreferences (android) or Keychain (iOS)
 */
async function setItem(key: string, value: string): Promise<void> {
  const vKey = `${VERSION}_${key}`
  await SecureStore.setItemAsync(vKey, value)
}

/**
 * Read an item stored in the SharedPreferences (android) or Keychain (iOS)
 */
function getItem(key: string): Promise<string | null> {
  const vKey = `${VERSION}_${key}`
  return SecureStore.getItemAsync(vKey)
}

/**
 * Delete an item stored in the SharedPreferences (android) or Keychain (iOS)
 */
function deleteItem(key: string): Promise<void> {
  const vKey = `${VERSION}_${key}`
  return SecureStore.deleteItemAsync(vKey)
}

function getKeySecretStoreKey(accountId: string, keyIndex: number) {
  return `${KEY_SECRET_PREFIX}.${accountId}.${keyIndex}`
}

function getKeyIvStoreKey(accountId: string, keyIndex: number) {
  return `${KEY_IV_PREFIX}.${accountId}.${keyIndex}`
}

async function storeKeySecret(
  accountId: string,
  keyIndex: number,
  secret: string,
  iv: string
) {
  await setItem(getKeySecretStoreKey(accountId, keyIndex), secret)
  await setItem(getKeyIvStoreKey(accountId, keyIndex), iv)
}

async function getKeySecret(
  accountId: string,
  keyIndex: number
): Promise<{ secret: string; iv: string } | null> {
  const secret = await getItem(getKeySecretStoreKey(accountId, keyIndex))
  const iv = await getItem(getKeyIvStoreKey(accountId, keyIndex))
  if (!secret || !iv) {
    return null
  }
  return { iv, secret }
}

async function deleteKeySecret(accountId: string, keyIndex: number) {
  await deleteItem(getKeySecretStoreKey(accountId, keyIndex))
  await deleteItem(getKeyIvStoreKey(accountId, keyIndex))
}

async function deleteAllKeySecrets(accountId: string, keyCount: number) {
  for (let i = 0; i < keyCount; i += 1) {
    await deleteKeySecret(accountId, i)
  }
}

async function storeEcashMnemonic(
  accountId: string,
  mnemonic: string
): Promise<void> {
  await setItem(`${ECASH_MNEMONIC_PREFIX}.${accountId}`, mnemonic)
}

function getEcashMnemonic(accountId: string): Promise<string | null> {
  return getItem(`${ECASH_MNEMONIC_PREFIX}.${accountId}`)
}

async function deleteEcashMnemonic(accountId: string): Promise<void> {
  await deleteItem(`${ECASH_MNEMONIC_PREFIX}.${accountId}`)
}

async function storeArkMnemonic(
  accountId: string,
  mnemonic: string
): Promise<void> {
  await setItem(`${ARK_MNEMONIC_PREFIX}.${accountId}`, mnemonic)
}

function getArkMnemonic(accountId: string): Promise<string | null> {
  return getItem(`${ARK_MNEMONIC_PREFIX}.${accountId}`)
}

async function deleteArkMnemonic(accountId: string): Promise<void> {
  await deleteItem(`${ARK_MNEMONIC_PREFIX}.${accountId}`)
}

export {
  deleteAllKeySecrets,
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteItem,
  deleteKeySecret,
  getArkMnemonic,
  getEcashMnemonic,
  getItem,
  getKeySecret,
  setItem,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret
}
