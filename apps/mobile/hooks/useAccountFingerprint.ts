import { useEffect, useState } from 'react'

import { type Account } from '@/types/models/Account'
import { getAccountFingerprintWithDecryption } from '@/utils/account'

function useAccountFingerprint(account: Account): string {
  const [fingerprint, setFingerprint] = useState('')

  useEffect(() => {
    async function loadFingerprint() {
      if (!account) {
        setFingerprint('')
        return
      }

      try {
        const fingerprint = await getAccountFingerprintWithDecryption(account)
        setFingerprint(fingerprint)
      } catch {
        setFingerprint('')
      }
    }

    loadFingerprint()
  }, [account])

  return fingerprint
}

export default useAccountFingerprint
