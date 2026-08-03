import * as SecureStore from 'expo-secure-store'

import type { EncryptedKeySecret } from '@/types/models/Account'

const VERSION = '1'
const KEY_SECRET_PREFIX = 'key_secret'
const KEY_IV_PREFIX = 'key_iv'
const ECASH_MNEMONIC_PREFIX = 'ecash_mnemonic'
const ARK_MNEMONIC_PREFIX = 'ark_mnemonic'
const NOSTR_IDENTITY_SECRET_PREFIX = 'nostr_identity_secret'
const NOSTR_IDENTITY_IV_PREFIX = 'nostr_identity_iv'
const NOSTR_ACCOUNT_SECRET_PREFIX = 'nostr_account_secret'
const NOSTR_ACCOUNT_IV_PREFIX = 'nostr_account_iv'

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

function getStoreKeyForKeySecret(accountId: string, keyIndex: number) {
  return `${KEY_SECRET_PREFIX}.${accountId}.${keyIndex}`
}

function getStoreKeyForKeyIv(accountId: string, keyIndex: number) {
  return `${KEY_IV_PREFIX}.${accountId}.${keyIndex}`
}

async function storeKeySecret(
  accountId: string,
  keyIndex: number,
  secret: string,
  iv: string
) {
  await setItem(getStoreKeyForKeySecret(accountId, keyIndex), secret)
  await setItem(getStoreKeyForKeyIv(accountId, keyIndex), iv)
}

async function getKeySecret(
  accountId: string,
  keyIndex: number
): Promise<EncryptedKeySecret | null> {
  const secret = await getItem(getStoreKeyForKeySecret(accountId, keyIndex))
  const iv = await getItem(getStoreKeyForKeyIv(accountId, keyIndex))
  if (!secret || !iv) {
    return null
  }
  return { iv, secret }
}

async function deleteKeySecret(accountId: string, keyIndex: number) {
  await deleteItem(getStoreKeyForKeySecret(accountId, keyIndex))
  await deleteItem(getStoreKeyForKeyIv(accountId, keyIndex))
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

async function storeNostrIdentitySecret(
  npub: string,
  secret: string,
  iv: string
): Promise<void> {
  await setItem(`${NOSTR_IDENTITY_SECRET_PREFIX}.${npub}`, secret)
  await setItem(`${NOSTR_IDENTITY_IV_PREFIX}.${npub}`, iv)
}

async function getNostrIdentitySecret(
  npub: string
): Promise<EncryptedKeySecret | null> {
  const secret = await getItem(`${NOSTR_IDENTITY_SECRET_PREFIX}.${npub}`)
  const iv = await getItem(`${NOSTR_IDENTITY_IV_PREFIX}.${npub}`)
  if (!secret || !iv) {
    return null
  }
  return { iv, secret }
}

async function deleteNostrIdentitySecret(npub: string): Promise<void> {
  await deleteItem(`${NOSTR_IDENTITY_SECRET_PREFIX}.${npub}`)
  await deleteItem(`${NOSTR_IDENTITY_IV_PREFIX}.${npub}`)
}

async function storeNostrAccountSecret(
  accountId: string,
  secret: string,
  iv: string
): Promise<void> {
  await setItem(`${NOSTR_ACCOUNT_SECRET_PREFIX}.${accountId}`, secret)
  await setItem(`${NOSTR_ACCOUNT_IV_PREFIX}.${accountId}`, iv)
}

async function getNostrAccountSecret(
  accountId: string
): Promise<EncryptedKeySecret | null> {
  const secret = await getItem(`${NOSTR_ACCOUNT_SECRET_PREFIX}.${accountId}`)
  const iv = await getItem(`${NOSTR_ACCOUNT_IV_PREFIX}.${accountId}`)
  if (!secret || !iv) {
    return null
  }
  return { iv, secret }
}

async function deleteNostrAccountSecret(accountId: string): Promise<void> {
  await deleteItem(`${NOSTR_ACCOUNT_SECRET_PREFIX}.${accountId}`)
  await deleteItem(`${NOSTR_ACCOUNT_IV_PREFIX}.${accountId}`)
}

export {
  deleteAllKeySecrets,
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteItem,
  deleteKeySecret,
  deleteNostrAccountSecret,
  deleteNostrIdentitySecret,
  getArkMnemonic,
  getEcashMnemonic,
  getItem,
  getKeySecret,
  getNostrAccountSecret,
  getNostrIdentitySecret,
  setItem,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret,
  storeNostrAccountSecret,
  storeNostrIdentitySecret
}
