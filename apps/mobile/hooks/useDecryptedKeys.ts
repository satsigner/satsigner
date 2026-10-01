import { useEffect, useState } from 'react'

import { type Account, type Key } from '@/types/models/Account'
import { decryptAccountKeySecret } from '@/utils/decryption'

/**
 * Decrypts every key secret of the account. A key that fails to decrypt is
 * returned unchanged, so signing can still use the keys that did.
 */
export function decryptAccountKeysOrFallback(account: Account) {
  return Promise.all(
    account.keys.map(async (key, index) => {
      try {
        const secret = await decryptAccountKeySecret(account.id, index)
        return { ...key, secret }
      } catch {
        return key
      }
    })
  )
}

/**
 * Decrypts the account's key secrets for signing. Keys that fail to decrypt
 * are returned unchanged (still encrypted).
 */
export function useDecryptedKeys(account: Account | undefined) {
  const [decryptedKeys, setDecryptedKeys] = useState<Key[]>([])

  useEffect(() => {
    if (!account || !account.keys || account.keys.length === 0) {
      return
    }
    async function decryptKeys(accountToDecrypt: Account) {
      setDecryptedKeys(await decryptAccountKeysOrFallback(accountToDecrypt))
    }
    decryptKeys(account)
  }, [account])

  return decryptedKeys
}
