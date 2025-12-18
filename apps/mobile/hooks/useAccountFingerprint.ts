import { useEffect, useState } from 'react'

import { type Account } from '@/types/models/Account'
import { extractAccountFingerprintWithDecryption } from '@/utils/account'
function useAccountFingerprint(account: Account): string {
  const [fingerprint, setFingerprint] = useState<string>('')

  // Extract complex dependency to avoid linting issues
  const accountFingerprint = account?.keys?.[0]?.fingerprint

  useEffect(() => {
    async function loadFingerprint() {
      if (!account) {
        setFingerprint('')
        return
      }

      try {
        const result = await extractAccountFingerprintWithDecryption(account)
        setFingerprint(result)
      } catch {
        setFingerprint('')
      }
    }

    loadFingerprint()
  }, [account, account?.id, accountFingerprint])

  return fingerprint
}

export default useAccountFingerprint
