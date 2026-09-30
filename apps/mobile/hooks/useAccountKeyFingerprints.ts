import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'

import { type Account } from '@/types/models/Account'
import { getKeyFingerprint } from '@/utils/account'
import { type KeyFingerprintsByAccount } from '@/utils/psbt'

async function fetchKeyFingerprints(
  accounts: Account[]
): Promise<KeyFingerprintsByAccount> {
  const entries = await Promise.all(
    accounts.map(
      async (account): Promise<[string, string[]]> => [
        account.id,
        await Promise.all(account.keys.map(getKeyFingerprint))
      ]
    )
  )
  return Object.fromEntries(entries)
}

/** Fingerprints of every key per account id, in key order. */
export function useAccountKeyFingerprints(accounts: Account[]) {
  const queryClient = useQueryClient()
  const options = queryOptions({
    queryFn: () => fetchKeyFingerprints(accounts),
    queryKey: [
      'account-key-fingerprints',
      accounts.map((account) => [account.id, account.keys.length])
    ],
    staleTime: Infinity
  })
  const query = useQuery(options)

  return {
    ...query,
    ensureKeyFingerprints: () => queryClient.ensureQueryData(options)
  }
}
