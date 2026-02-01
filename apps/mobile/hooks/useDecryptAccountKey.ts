import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import type { Account, Secret } from '@/types/models/Account'
import { aesDecrypt } from '@/utils/crypto'

export default function useDecryptAccountKey() {
  async function decryptAccountKeySecretHelper(
    account: Account,
    keyIndex: number,
    pin: string
  ) {
    // key validation
    const key = account.keys[keyIndex]
    if (!key) {
      throw new Error(
        `Undefined key at index ${keyIndex} for account "${account.name}"`
      )
    }

    if (typeof key.secret === 'object') return key.secret

    // decryption validation
    let decryptedSecret = ''
    try {
      decryptedSecret = await aesDecrypt(key.secret, pin, key.iv)
    } catch {
      throw new Error(
        `AES decryption failed for key #${keyIndex} of account "${account.name}"`
      )
    }

    // parse validation
    let secretObject: object = {}
    try {
      secretObject = JSON.parse(decryptedSecret)
    } catch {
      throw new Error(
        `Failed to parse decrypted key secret for key #${keyIndex} of account "${account.name}".`
      )
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
      throw new Error(
        `Invalid serialized secret for key #${keyIndex} of account "${account.name}"`
      )
    }

    return secretObject as Secret
  }

  async function decryptAccountKeySecret(account: Account, keyIndex: number) {
    const pin = await getItem(PIN_KEY)
    if (!pin) {
      throw new Error(
        `Failed to obtain PIN to decrypt key #${keyIndex} of account "${account.name}"`
      )
    }

    return decryptAccountKeySecretHelper(account, keyIndex, pin)
  }

  async function decryptAllAccountKeySecrets(account: Account) {
    const pin = await getItem(PIN_KEY)
    if (!pin) {
      throw new Error(
        `Failed to obtain PIN to decrypt secrets of account "${account.name}"`
      )
    }

    const secrets: Secret[] = []
    for (let index = 0; index < account.keys.length; index++) {
      const secret = await decryptAccountKeySecretHelper(account, index, pin)
      secrets.push(secret)
    }
    return secrets
  }

  return {
    decryptAccountKeySecret,
    decryptAllAccountKeySecrets
  }
}
