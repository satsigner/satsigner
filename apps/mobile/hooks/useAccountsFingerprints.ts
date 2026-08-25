import { useEffect, useState } from 'react'

import { type Account } from '@/types/models/Account'
import { getAccountFingerprintWithDecryption } from '@/utils/account'

type FingerprintMap = Record<string, string>

function useAccountsFingerprints(accounts: Account[]): FingerprintMap {
  const [fingerprints, setFingerprints] = useState<FingerprintMap>({})

  useEffect(() => {
    let active = true

    async function loadFingerprints() {
      const entries = await Promise.all(
        accounts.map(async (account) => {
          try {
            const fingerprint =
              await getAccountFingerprintWithDecryption(account)
            return [account.id, fingerprint] as const
          } catch {
            return [account.id, ''] as const
          }
        })
      )

      if (active) {
        setFingerprints(Object.fromEntries(entries))
      }
    }

    loadFingerprints()

    return () => {
      active = false
    }
  }, [accounts])

  return fingerprints
}

export default useAccountsFingerprints
