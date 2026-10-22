import { useEffect, useState } from 'react'

import { type Account, type Key } from '@/types/models/Account'
import { haveSameKeys } from '@/utils/account'
import { decryptAccountKeysOrFallback } from '@/utils/decryption'

const NO_KEYS: Key[] = []

type DecryptedAccountKeys = {
  accountId: string
  sourceKeys: Key[]
  keys: Key[]
}

export function useDecryptedKeys(
  account: Pick<Account, 'id' | 'keys'> | undefined
) {
  const [decrypted, setDecrypted] = useState<DecryptedAccountKeys>()
  const accountId = account?.id
  const keys = account?.keys

  useEffect(() => {
    if (!accountId || !keys || keys.length === 0) {
      return
    }
    const decryptionRun = { isOutdated: false }
    async function decryptKeys(id: string, accountKeys: Key[]) {
      const result = await decryptAccountKeysOrFallback({
        id,
        keys: accountKeys
      })
      if (!decryptionRun.isOutdated) {
        setDecrypted({ accountId: id, keys: result, sourceKeys: accountKeys })
      }
    }
    void decryptKeys(accountId, keys)
    return () => {
      decryptionRun.isOutdated = true
    }
  }, [accountId, keys])

  const isDecryptedForCurrentKeys =
    !!keys?.length &&
    !!decrypted &&
    decrypted.accountId === accountId &&
    haveSameKeys(decrypted.sourceKeys, keys)
  if (!isDecryptedForCurrentKeys) {
    return NO_KEYS
  }
  return decrypted.keys
}
