import { PIN_KEY } from '@/config/auth'
import { getItem, getKeySecret, storeKeySecret } from '@/storage/encrypted'
import type {
  Account,
  DecryptedAccount,
  DecryptedKey,
  Key,
  Secret
} from '@/types/models/Account'
import { aesDecrypt, aesEncrypt } from '@/utils/crypto'
import { getUtxoOutpoint } from '@/utils/utxo'

const MAX_DAYS_WITHOUT_SYNCING = 3

function addContextToError(
  error: unknown,
  context: string,
  fallbackMessage: string
) {
  return new Error(
    error instanceof Error
      ? `${error.message} ${context}`
      : `${fallbackMessage} ${context}`
  )
}

// update labels in the field transactions, utxos, and addresses
// using the field labels.
export function updateAccountObjectLabels(account: Account) {
  const labels = { ...account.labels }
  const updatedAccount: Account = {
    ...account,
    addresses: account.addresses.map((a) => ({ ...a })),
    transactions: account.transactions.map((t) => ({ ...t })),
    utxos: account.utxos.map((u) => ({ ...u }))
  }

  for (const [index, utxo] of updatedAccount.utxos.entries()) {
    const utxoRef = getUtxoOutpoint(utxo)
    let label = labels[utxoRef]?.label

    // fall back to utxo's address's label
    if (!label && utxo.addressTo) {
      label = labels[utxo.addressTo]?.label
    }

    // save label inherited from address
    if (label && !labels[utxoRef]) {
      labels[utxoRef] = {
        label,
        ref: utxoRef,
        type: 'output'
      }
    }
    updatedAccount.utxos[index].label = label || ''
  }

  for (const [index, tx] of updatedAccount.transactions.entries()) {
    const { id: txRef, vout, vin } = tx
    let label = labels[txRef]?.label

    // fall back to tx's address' label
    if (!label && tx.vout.length > 0) {
      label = ''
      for (const output of tx.vout) {
        const outputAddress = output.address
        const outputLabel = labels[outputAddress]?.label
        if (!outputLabel) {
          continue
        }
        label += `${outputLabel},`
      }
      label = label.replace(/,$/, '')
    }

    // save label inherited from address
    if (label && !labels[txRef]) {
      labels[txRef] = {
        label,
        ref: txRef,
        type: 'tx'
      }
    }

    updatedAccount.transactions[index].label = label || ''

    updatedAccount.transactions[index].vout = vout.map((output, vout) => {
      const outputRef = `${tx.id}:${vout}`
      let outputLabel = labels[outputRef]?.label || ''
      if (!outputLabel && label) {
        outputLabel = `${label} (output ${vout})`
      }
      return {
        ...output,
        label: outputLabel
      }
    })

    updatedAccount.transactions[index].vin = vin.map((input, vin) => {
      const { txid, vout } = input.previousOutput
      const inputRef = `${txid}:${vout}`
      let inputLabel = labels[inputRef]?.label
      if (!inputLabel && label) {
        inputLabel = `${label} (input ${vin})`
      }
      return {
        ...input,
        label: inputLabel
      }
    })
  }

  for (const [index, addr] of updatedAccount.addresses.entries()) {
    const addressRef = addr.address
    const label = labels[addressRef]?.label
    updatedAccount.addresses[index].label = label || ''
  }

  updatedAccount.labels = { ...labels }

  return updatedAccount
}

export async function getPin() {
  const pin = await getItem(PIN_KEY)
  if (!pin) {
    throw new Error('Failed to obtain PIN for decryption')
  }
  return pin
}

// decrypt key secret from expo-secure-store using account context
export async function decryptKeySecretFromStore(
  accountId: string,
  keyIndex: number,
  pin: string
): Promise<Secret> {
  const stored = await getKeySecret(accountId, keyIndex)
  if (!stored) {
    throw new Error(`Key secret not found in secure storage (key #${keyIndex})`)
  }

  let decryptedSecret = ''
  try {
    decryptedSecret = await aesDecrypt(stored.secret, pin, stored.iv)
  } catch {
    throw new Error('AES decryption failed')
  }

  let secretObject: object = {}
  try {
    secretObject = JSON.parse(decryptedSecret)
  } catch {
    throw new Error('Failed to parse decrypted key secret')
  }

  const expectedObjKeys = new Set([
    'mnemonic',
    'passphrase',
    'externalDescriptor',
    'internalDescriptor',
    'extendedPublicKey',
    'fingerprint'
  ])
  if (Object.keys(secretObject).some((k) => !expectedObjKeys.has(k))) {
    throw new Error('Invalid serialized secret')
  }

  return secretObject as Secret
}

// decrypt key secret without account context using provided PIN
// (used during builder flow when secret is still in memory)
export async function decryptKeySecretUsingPin(key: Key, pin: string) {
  // object already decrypt
  if (typeof key.secret === 'object') {
    return key.secret
  }

  // decryption validation
  let decryptedSecret = ''
  try {
    decryptedSecret = await aesDecrypt(key.secret, pin, key.iv)
  } catch {
    throw new Error('AES decryption failed')
  }

  // parse validation
  let secretObject: object = {}
  try {
    secretObject = JSON.parse(decryptedSecret)
  } catch {
    throw new Error('Failed to parse decrypted key secret')
  }

  // serialized object validation
  const expectedObjKeys = new Set([
    'mnemonic',
    'passphrase',
    'externalDescriptor',
    'internalDescriptor',
    'extendedPublicKey',
    'fingerprint'
  ])
  if (Object.keys(secretObject).some((k) => !expectedObjKeys.has(k))) {
    throw new Error('Invalid serialized secret')
  }

  return secretObject as Secret
}

export async function dropSeedFromKey(
  accountId: string,
  key: Key,
  keyIndex: number
) {
  const pin = await getPin()
  const stored = await getKeySecret(accountId, keyIndex)
  if (!stored) {
    throw new Error('Key secret not found in secure storage')
  }

  const decryptedString = await aesDecrypt(stored.secret, pin, stored.iv)
  const decryptedSecret = JSON.parse(decryptedString) as Secret
  const secretWithoutSeed: Secret = {
    extendedPublicKey: decryptedSecret.extendedPublicKey,
    externalDescriptor: decryptedSecret.externalDescriptor,
    fingerprint: decryptedSecret.fingerprint,
    internalDescriptor: decryptedSecret.internalDescriptor
  }
  const stringifiedSecret = JSON.stringify(secretWithoutSeed)
  const encryptedSecret = await aesEncrypt(stringifiedSecret, pin, stored.iv)
  await storeKeySecret(accountId, keyIndex, encryptedSecret, stored.iv)
  return { ...key }
}

/**
 * Strip mnemonic from an in-memory key (builder flow, not yet persisted).
 * For persisted keys, use dropSeedFromKey which reads/writes secure store.
 */
export function dropSeedFromKeyInMemory(key: Key): Key {
  const { secret } = key
  if (typeof secret !== 'object') {
    throw new TypeError('Expected unencrypted secret object')
  }
  return {
    ...key,
    secret: {
      extendedPublicKey: secret.extendedPublicKey,
      externalDescriptor: secret.externalDescriptor,
      fingerprint: secret.fingerprint,
      internalDescriptor: secret.internalDescriptor
    }
  }
}

// decrypt key secret without account context using PIN from store
export async function decryptKeySecret(key: Key) {
  const pin = await getPin()
  return decryptKeySecretUsingPin(key, pin)
}

// decrypt key secret knowing account context — reads from secure store
export async function decryptKeySecretAt(
  accountId: string,
  keyIndex: number,
  pin: string
) {
  try {
    return await decryptKeySecretFromStore(accountId, keyIndex, pin)
  } catch (error) {
    throw addContextToError(error, `[key #${keyIndex}]`, 'Decryption failed')
  }
}

export async function decryptAccountKeySecret(
  account: Account,
  keyIndex: number
) {
  try {
    const pin = await getPin()
    return decryptKeySecretAt(account.id, keyIndex, pin)
  } catch (error) {
    throw addContextToError(
      error,
      `(key #${keyIndex} account ${account.name})`,
      'Decryption of secret failed'
    )
  }
}

export async function decryptAllAccountKeySecrets(account: Account) {
  try {
    const secrets: Secret[] = []
    const pin = await getPin()
    for (let index = 0; index < account.keys.length; index += 1) {
      const secret = await decryptKeySecretAt(account.id, index, pin)
      secrets.push(secret)
    }
    return secrets
  } catch (error) {
    throw addContextToError(
      error,
      `(account ${account.name})`,
      'Decryption of secret failed'
    )
  }
}

export async function getAccountWithDecryptedKeys(account: Account) {
  const decryptedSecrets = await decryptAllAccountKeySecrets(account)
  const decryptedAccount: DecryptedAccount = {
    ...account,
    keys: account.keys.map((key, index) => {
      const decryptedKey: DecryptedKey = {
        ...key,
        secret: decryptedSecrets[index]
      }
      return decryptedKey
    })
  }
  return decryptedAccount
}

export function getAccountFingerprint(
  account: Account,
  decryptedKeys?: Key[]
): string {
  if (!account?.keys?.length) {
    return ''
  }

  const [firstKey] = account.keys

  if (decryptedKeys && decryptedKeys.length > 0) {
    const [decryptedKey] = decryptedKeys
    if (decryptedKey) {
      if (
        typeof decryptedKey.secret === 'object' &&
        decryptedKey.secret.fingerprint
      ) {
        return decryptedKey.secret.fingerprint
      }
      if (decryptedKey.fingerprint) {
        return decryptedKey.fingerprint
      }
    }
  }

  if (typeof firstKey.secret === 'object' && firstKey.secret.fingerprint) {
    return firstKey.secret.fingerprint
  }

  if (firstKey.fingerprint) {
    return firstKey.fingerprint
  }

  return ''
}

export function getAccountFingerprintWithDecryption(
  account: Account
): Promise<string> {
  return getKeyFingerprint(account.keys[0])
}

export async function getKeyFingerprint(key: Key): Promise<string> {
  if (key.fingerprint) {
    return key.fingerprint
  }
  const decryptedSecret = await decryptKeySecret(key)
  return decryptedSecret.fingerprint || ''
}

export function checkWalletNeedsSync(
  account: Account,
  maxDaysWithoutSyncing: number = MAX_DAYS_WITHOUT_SYNCING
): boolean {
  if (account.lastSyncedAt === undefined) {
    return true
  }

  let lastSync: Date
  try {
    const lastSyncedAtValue = account.lastSyncedAt

    if (lastSyncedAtValue instanceof Date) {
      lastSync = lastSyncedAtValue
    } else {
      // If it's a string or number, try to create a Date
      lastSync = new Date(lastSyncedAtValue)

      if (isNaN(lastSync.getTime())) {
        return true
      }
    }
  } catch {
    return true
  }

  const now = new Date()

  // Discard the time and time-zone information.
  const currentUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  const lastSyncedUtc = Date.UTC(
    lastSync.getFullYear(),
    lastSync.getMonth(),
    lastSync.getDate()
  )

  const MILISECONDS_PER_DAY = 1000 * 60 * 60 * 24
  const daysSinceLastSync = Math.floor(
    (currentUtc - lastSyncedUtc) / MILISECONDS_PER_DAY
  )

  // Account updated too long ago.
  return daysSinceLastSync > maxDaysWithoutSyncing
}
