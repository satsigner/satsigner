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
        await Promise.all(
          account.keys.map((key) => getKeyFingerprint(key).catch(() => ''))
        )
      ]
    )
  )
  return Object.fromEntries(entries)
}

function keyFingerprintsQueryOptions(accounts: Account[]) {
  return queryOptions({
    queryFn: () => fetchKeyFingerprints(accounts),
    // Non-secret per-key markers: stored fingerprint, else the IV (changes on re-encryption)
    queryKey: [
      'account-key-fingerprints',
      accounts.map((account) => [
        account.id,
        account.keys.map((key) => key.fingerprint ?? key.iv)
      ])
    ],
    staleTime: Infinity
  })
}

/**
 * Fingerprints of every key per account id, in key order.
 * Resolves on mount, decrypting key secrets that lack a stored fingerprint.
 */
export function useAccountKeyFingerprints(accounts: Account[]) {
  return useQuery(keyFingerprintsQueryOptions(accounts))
}

/**
 * Same data as `useAccountKeyFingerprints`, resolved only when the returned
 * loader is called, so key secrets are not decrypted on mount.
 */
export function useAccountKeyFingerprintsLoader(accounts: Account[]) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.ensureQueryData(keyFingerprintsQueryOptions(accounts))
}
