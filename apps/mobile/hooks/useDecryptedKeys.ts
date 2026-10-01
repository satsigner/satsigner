import { useEffect, useState } from 'react'

import { type Account, type Key } from '@/types/models/Account'
import { decryptAccountKeysOrFallback } from '@/utils/decryption'

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
    decryptAccountKeysOrFallback(account).then(setDecryptedKeys)
  }, [account])

  return decryptedKeys
}
