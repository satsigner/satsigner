import { PIN_KEY } from '@/config/auth'
import { getItem, getKeySecret } from '@/storage/encrypted'
import type {
  Account,
  DecryptedAccount,
  DecryptedKey,
  Key,
  Secret
} from '@/types/models/Account'
import { aesDecrypt } from '@/utils/crypto'

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

export async function getPin() {
  const pin = await getItem(PIN_KEY)
  if (!pin) {
    throw new Error('Failed to obtain PIN for decryption')
  }
  return pin
}

// decrypt account key secret from expo-secure-store using provided pin
export async function decryptAccountKeySecretUsingPin(
  accountId: Account['id'],
  keyIndex: Key['index'],
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

// decrypt account key secret from expo-secure-store using PIN from store
export async function decryptAccountKeySecret(
  accountId: Account['id'],
  keyIndex: Key['index']
) {
  const pin = await getPin()
  return decryptAccountKeySecretUsingPin(accountId, keyIndex, pin)
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
    return await decryptAccountKeySecretUsingPin(accountId, keyIndex, pin)
  } catch (error) {
    throw addContextToError(error, `[key #${keyIndex}]`, 'Decryption failed')
  }
}

export async function decryptBitcoinKeySecret(
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

export async function decryptAllBitcoinKeySecrets(account: Account) {
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

export async function getBitcoinWithDecryptedKeys(account: Account) {
  const decryptedSecrets = await decryptAllBitcoinKeySecrets(account)
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
