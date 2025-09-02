import { useEffect, useState } from 'react'

import { type Account } from '@/types/models/Account'
import { extractAccountFingerprintWithDecryption } from '@/utils/account'

/**
 * Hook to extract and manage account fingerprint state
 * Handles both encrypted and decrypted secrets, including skipPin scenarios
 * @param account The account to extract fingerprint from
 * @returns The fingerprint string or empty string if not found
 */
function useAccountFingerprint(account: Account): string {
  const [fingerprint, setFingerprint] = useState<string>('')

  // Extract complex dependencies to separate variables for static checking
  const accountId = account?.id
  const firstKeyFingerprint = account?.keys?.[0]?.fingerprint

  useEffect(() => {
    async function loadFingerprint() {
      if (!account) {
        setFingerprint('')
        return
      }

      try {
        const result = await extractAccountFingerprintWithDecryption(account)
        setFingerprint(result)
      } catch (_error) {
        setFingerprint('')
      }
    }

    loadFingerprint()
  }, [account, accountId, firstKeyFingerprint])

  return fingerprint
}

export default useAccountFingerprint
