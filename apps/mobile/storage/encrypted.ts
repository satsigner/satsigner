import * as SecureStore from 'expo-secure-store'

import type { EncryptedKeySecret } from '@/types/models/Account'
import { isRecord } from '@/utils/object'

const VERSION = '1'
const KEY_SECRET_PREFIX = 'key_secret'
const KEY_IV_PREFIX = 'key_iv'
const ECASH_MNEMONIC_PREFIX = 'ecash_mnemonic'
const ARK_MNEMONIC_PREFIX = 'ark_mnemonic'
const NOSTR_IDENTITY_SECRET_PREFIX = 'nostr_identity_secret'
const NOSTR_IDENTITY_IV_PREFIX = 'nostr_identity_iv'
const NOSTR_ACCOUNT_SECRET_PREFIX = 'nostr_account_secret'
const NOSTR_ACCOUNT_IV_PREFIX = 'nostr_account_iv'
const LND_CONFIG_SECRET_PREFIX = 'lnd_config_secret'
const LND_CONFIG_IV_PREFIX = 'lnd_config_iv'
const RPC_CREDENTIALS_SECRET_PREFIX = 'rpc_credentials_secret'
const RPC_CREDENTIALS_IV_PREFIX = 'rpc_credentials_iv'
const PAIR_SUFFIX = 'pair'

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

function parseEncryptedPair(raw: string): EncryptedKeySecret | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return null
    }
    const { iv, secret } = parsed
    if (typeof iv !== 'string' || typeof secret !== 'string') {
      return null
    }
    return iv && secret ? { iv, secret } : null
  } catch {
    return null
  }
}

/**
 * Writes a ciphertext and its IV as one item, so an interrupted write cannot
 * leave a ciphertext next to the IV of an older one. Items written before
 * this kept them apart; those are removed once the pair has landed.
 */
async function storeEncryptedPair(
  secretKey: string,
  ivKey: string,
  value: EncryptedKeySecret
): Promise<void> {
  await setItem(
    `${secretKey}.${PAIR_SUFFIX}`,
    JSON.stringify({ iv: value.iv, secret: value.secret })
  )
  await deleteItem(secretKey)
  await deleteItem(ivKey)
}

async function getEncryptedPair(
  secretKey: string,
  ivKey: string
): Promise<EncryptedKeySecret | null> {
  const raw = await getItem(`${secretKey}.${PAIR_SUFFIX}`)
  const pair = raw ? parseEncryptedPair(raw) : null
  if (pair) {
    return pair
  }
  const secret = await getItem(secretKey)
  const iv = await getItem(ivKey)
  if (!secret || !iv) {
    return null
  }
  return { iv, secret }
}

async function deleteEncryptedPair(
  secretKey: string,
  ivKey: string
): Promise<void> {
  await deleteItem(`${secretKey}.${PAIR_SUFFIX}`)
  await deleteItem(secretKey)
  await deleteItem(ivKey)
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
  await storeEncryptedPair(
    getStoreKeyForKeySecret(accountId, keyIndex),
    getStoreKeyForKeyIv(accountId, keyIndex),
    { iv, secret }
  )
}

function getKeySecret(
  accountId: string,
  keyIndex: number
): Promise<EncryptedKeySecret | null> {
  return getEncryptedPair(
    getStoreKeyForKeySecret(accountId, keyIndex),
    getStoreKeyForKeyIv(accountId, keyIndex)
  )
}

async function deleteKeySecret(accountId: string, keyIndex: number) {
  await deleteEncryptedPair(
    getStoreKeyForKeySecret(accountId, keyIndex),
    getStoreKeyForKeyIv(accountId, keyIndex)
  )
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
  await storeEncryptedPair(
    `${NOSTR_IDENTITY_SECRET_PREFIX}.${npub}`,
    `${NOSTR_IDENTITY_IV_PREFIX}.${npub}`,
    { iv, secret }
  )
}

function getNostrIdentitySecret(
  npub: string
): Promise<EncryptedKeySecret | null> {
  return getEncryptedPair(
    `${NOSTR_IDENTITY_SECRET_PREFIX}.${npub}`,
    `${NOSTR_IDENTITY_IV_PREFIX}.${npub}`
  )
}

function deleteNostrIdentitySecret(npub: string): Promise<void> {
  return deleteEncryptedPair(
    `${NOSTR_IDENTITY_SECRET_PREFIX}.${npub}`,
    `${NOSTR_IDENTITY_IV_PREFIX}.${npub}`
  )
}

async function storeNostrAccountSecret(
  accountId: string,
  secret: string,
  iv: string
): Promise<void> {
  await storeEncryptedPair(
    `${NOSTR_ACCOUNT_SECRET_PREFIX}.${accountId}`,
    `${NOSTR_ACCOUNT_IV_PREFIX}.${accountId}`,
    { iv, secret }
  )
}

function getNostrAccountSecret(
  accountId: string
): Promise<EncryptedKeySecret | null> {
  return getEncryptedPair(
    `${NOSTR_ACCOUNT_SECRET_PREFIX}.${accountId}`,
    `${NOSTR_ACCOUNT_IV_PREFIX}.${accountId}`
  )
}

function deleteNostrAccountSecret(accountId: string): Promise<void> {
  return deleteEncryptedPair(
    `${NOSTR_ACCOUNT_SECRET_PREFIX}.${accountId}`,
    `${NOSTR_ACCOUNT_IV_PREFIX}.${accountId}`
  )
}

async function storeLndConfigSecret(secret: string, iv: string): Promise<void> {
  await storeEncryptedPair(LND_CONFIG_SECRET_PREFIX, LND_CONFIG_IV_PREFIX, {
    iv,
    secret
  })
}

function getLndConfigSecret(): Promise<EncryptedKeySecret | null> {
  return getEncryptedPair(LND_CONFIG_SECRET_PREFIX, LND_CONFIG_IV_PREFIX)
}

function deleteLndConfigSecret(): Promise<void> {
  return deleteEncryptedPair(LND_CONFIG_SECRET_PREFIX, LND_CONFIG_IV_PREFIX)
}

async function storeRpcCredentialsSecret(
  network: string,
  secret: string,
  iv: string
): Promise<void> {
  await storeEncryptedPair(
    `${RPC_CREDENTIALS_SECRET_PREFIX}.${network}`,
    `${RPC_CREDENTIALS_IV_PREFIX}.${network}`,
    { iv, secret }
  )
}

function getRpcCredentialsSecret(
  network: string
): Promise<EncryptedKeySecret | null> {
  return getEncryptedPair(
    `${RPC_CREDENTIALS_SECRET_PREFIX}.${network}`,
    `${RPC_CREDENTIALS_IV_PREFIX}.${network}`
  )
}

function deleteRpcCredentialsSecret(network: string): Promise<void> {
  return deleteEncryptedPair(
    `${RPC_CREDENTIALS_SECRET_PREFIX}.${network}`,
    `${RPC_CREDENTIALS_IV_PREFIX}.${network}`
  )
}

export {
  deleteAllKeySecrets,
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteItem,
  deleteKeySecret,
  deleteLndConfigSecret,
  deleteNostrAccountSecret,
  deleteNostrIdentitySecret,
  deleteRpcCredentialsSecret,
  getArkMnemonic,
  getEcashMnemonic,
  getItem,
  getKeySecret,
  getLndConfigSecret,
  getNostrAccountSecret,
  getNostrIdentitySecret,
  getRpcCredentialsSecret,
  setItem,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret,
  storeLndConfigSecret,
  storeNostrAccountSecret,
  storeNostrIdentitySecret,
  storeRpcCredentialsSecret
}
