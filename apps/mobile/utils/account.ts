import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
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
    transactions: account.transactions.map((t) => ({ ...t })),
    utxos: account.utxos.map((u) => ({ ...u })),
    addresses: account.addresses.map((a) => ({ ...a }))
  }

  for (const index in updatedAccount.utxos) {
    const utxo = updatedAccount.utxos[index]
    const utxoRef = getUtxoOutpoint(utxo)
    let label = labels[utxoRef]?.label

    // fall back to utxo's address's label
    if (!label && utxo.addressTo) {
      label = labels[utxo.addressTo]?.label
    }

    // save label inherited from address
    if (label && !labels[utxoRef]) {
      labels[utxoRef] = {
        type: 'output',
        ref: utxoRef,
        label
      }
    }
    updatedAccount.utxos[index].label = label || ''
  }

  for (const index in updatedAccount.transactions) {
    const tx = updatedAccount.transactions[index]
    const { id: txRef, vout, vin } = tx
    let label = labels[txRef]?.label

    // fall back to tx's address' label
    if (!label && tx.vout.length > 0) {
      label = ''
      for (const output of tx.vout) {
        const outputAddress = output.address
        const outputLabel = labels[outputAddress]?.label
        if (!outputLabel) continue
        label += outputLabel + ','
      }
      label = label.replace(/,$/, '')
    }

    // save label inherited from address
    if (label && !labels[txRef]) {
      labels[txRef] = {
        type: 'tx',
        ref: txRef,
        label
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

  for (const index in updatedAccount.addresses) {
    const addressRef = updatedAccount.addresses[index].address
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

// decrypt key secret without account context using provided PIN
export async function decryptKeySecretUsingPin(key: Key, pin: string) {
  // object already decrypt
  if (typeof key.secret === 'object') return key.secret

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
  const expectedObjKeys = [
    'mnemonic',
    'passphrase',
    'externalDescriptor',
    'internalDescriptor',
    'extendedPublicKey',
    'fingerprint'
  ]
  if (Object.keys(secretObject).some((k) => !expectedObjKeys.includes(k))) {
    throw new Error('Invalid serialized secret')
  }

  return secretObject as Secret
}

export async function dropSeedFromKey(key: Key) {
  const pin = await getPin()
  const decryptedSecret = await decryptKeySecretUsingPin(key, pin)
  const secretWithoutSeed: Secret = {
    extendedPublicKey: decryptedSecret.extendedPublicKey,
    externalDescriptor: decryptedSecret.externalDescriptor,
    internalDescriptor: decryptedSecret.internalDescriptor,
    fingerprint: decryptedSecret.fingerprint
  }
  const stringifiedSecret = JSON.stringify(secretWithoutSeed)
  const encryptedSecret = await aesEncrypt(stringifiedSecret, pin, key.iv)
  stringifiedSecret.replace(/./g, '0')
  const newKey: Key = {
    ...key,
    secret: encryptedSecret
  }
  return newKey
}

// decrypt key secret without account context using PIN from store
export async function decryptKeySecret(key: Key) {
  const pin = await getPin()
  return decryptKeySecretUsingPin(key, pin)
}

// decrypt key secret knowing account context
export async function decryptKeySecretAt(
  keys: Account['keys'],
  keyIndex: number,
  pin: string
) {
  // key validation
  const key = keys[keyIndex]
  if (!key) {
    throw new Error(`Undefined key #${keyIndex}`)
  }

  try {
    const secret = await decryptKeySecretUsingPin(key, pin)
    return secret
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
    return decryptKeySecretAt(account.keys, keyIndex, pin)
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
    for (let index = 0; index < account.keys.length; index++) {
      const secret = await decryptKeySecretAt(account.keys, index, pin)
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

  const firstKey = account.keys[0]

  if (decryptedKeys && decryptedKeys.length > 0) {
    const decryptedKey = decryptedKeys[0]
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

export async function getAccountFingerprintWithDecryption(
  account: Account
): Promise<string> {
  if (account.keys.length < 0) return ''
  return getKeyFingerprint(account.keys[0])
}

export async function getKeyFingerprint(key: Key): Promise<string> {
  if (key.fingerprint) return key.fingerprint
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
