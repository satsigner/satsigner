import { useEffect, useState } from 'react'

import { type Account, type Key } from '@/types/models/Account'
import { decryptAccountKeysOrFallback } from '@/utils/decryption'

const NO_KEYS: Key[] = []

/**
 * Decrypts the account's key secrets for signing. Keys that fail to decrypt
 * are returned unchanged (still encrypted). Decrypts again only when the
 * account or its keys change, not on every account update. Empty until the
 * current account's keys are decrypted.
 */
export function useDecryptedKeys(
  account: Pick<Account, 'id' | 'keys'> | undefined
) {
  const [decrypted, setDecrypted] = useState<{
    accountId: string
    keys: Key[]
  }>()
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
        setDecrypted({ accountId: id, keys: result })
      }
    }
    void decryptKeys(accountId, keys)
    return () => {
      request.stale = true
    }
  }, [accountId, keys])

  // Never hands out another account's secrets while this one decrypts.
  if (!keys?.length || !decrypted || decrypted.accountId !== accountId) {
    return NO_KEYS
  }
  return decrypted.keys
}
