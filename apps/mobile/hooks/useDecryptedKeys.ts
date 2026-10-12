import { useEffect, useState } from 'react'

import { decryptAccountKeysOrFallback } from '@/api/decryption'
import { type Account, type Key } from '@/types/models/Account'

/**
 * Decrypts the account's key secrets for signing. Keys that fail to decrypt
 * are returned unchanged (still encrypted). Decrypts again only when the
 * account or its keys change, not on every account update.
 */
export function useDecryptedKeys(account: Account | undefined) {
  const [decryptedKeys, setDecryptedKeys] = useState<Key[]>([])
  const accountId = account?.id
  const keys = account?.keys

  useEffect(() => {
    if (!accountId || !keys || keys.length === 0) {
      return
    }
    // Drops a result that arrives after the account or keys changed.
    const request = { stale: false }
    async function decryptKeys(id: string, accountKeys: Key[]) {
      const result = await decryptAccountKeysOrFallback({
        id,
        keys: accountKeys
      })
      if (!request.stale) {
        setDecryptedKeys(result)
      }
    }
    void decryptKeys(accountId, keys)
    return () => {
      request.stale = true
    }
  }, [accountId, keys])

  return decryptedKeys
}
