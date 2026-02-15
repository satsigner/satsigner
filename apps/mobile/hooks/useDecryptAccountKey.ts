import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import type { Account, Key, Secret } from '@/types/models/Account'
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

export default function useDecryptAccountKey() {
  async function getPin() {
    const pin = await getItem(PIN_KEY)
    if (!pin) {
      throw new Error('Failed to obtain PIN for decryption')
    }
    return pin
  }

  // decrypt key secret without account context using provided PIN
  async function decryptKeySecretUsingPin(key: Key, pin: string) {
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

  // decrypt key secret without account context using PIN from store
  async function decryptKeySecret(key: Key) {
    const pin = await getPin()
    return decryptKeySecretUsingPin(key, pin)
  }

  // decrypt key secret knowing account context
  async function decryptKeySecretAt(
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

  async function decryptAccountKeySecret(account: Account, keyIndex: number) {
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

  async function decryptAllAccountKeySecrets(account: Account) {
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

  return {
    decryptAccountKeySecret,
    decryptAllAccountKeySecrets,
    decryptKeySecret,
    decryptKeySecretAt,
    getPin
  }
}
