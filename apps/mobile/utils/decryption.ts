import { getKeySecret } from '@/storage/encrypted'
import {
  SecretSchema,
  type Account,
  type DecryptedAccount,
  type DecryptedKey,
  type EncryptedKeySecret,
  type Key,
  type Secret
} from '@/types/models/Account'
import { aesDecrypt } from '@/utils/crypto'
import { getPin } from '@/utils/pin'

// TODO: create utils to enhance error handling
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

export async function decryptAccountKeySecretUsingPin(
  accountId: Account['id'],
  keyIndex: Key['index'],
  pin: string
): Promise<Secret> {
  const stored = await getKeySecret(accountId, keyIndex)
  if (!stored) {
    throw new Error(`Key secret not found in secure storage (key #${keyIndex})`)
  }
  return decryptKeySecretUsingPin(stored, pin)
}

export async function decryptAccountKeySecret(
  accountId: Account['id'],
  keyIndex: Key['index']
) {
  const pin = await getPin()
  return decryptAccountKeySecretUsingPin(accountId, keyIndex, pin)
}

export async function decryptKeySecretUsingPin(
  key: Key | EncryptedKeySecret,
  pin: string
): Promise<Secret> {
  if (typeof key.secret === 'object') {
    return key.secret
  }

  if (!key.secret) {
    if ('accountId' in key && key.accountId) {
      return decryptAccountKeySecretUsingPin(key.accountId, key.index, pin)
    }
    throw new Error(
      'Key secret not available: no in-memory secret and no account context'
    )
  }

  let decryptedSecret = ''
  try {
    decryptedSecret = await aesDecrypt(key.secret, pin, key.iv)
  } catch {
    throw new Error('AES decryption failed')
  }

  let secretObject: object = {}
  try {
    secretObject = JSON.parse(decryptedSecret)
  } catch {
    throw new Error('Invalid JSON object')
  }

  return SecretSchema.parse(secretObject)
}

export async function decryptKeySecret(key: Key | EncryptedKeySecret) {
  const pin = await getPin()
  return decryptKeySecretUsingPin(key, pin)
}

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

export async function decryptAccountKeySecrets(account: Account) {
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
  const decryptedSecrets = await decryptAccountKeySecrets(account)
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
