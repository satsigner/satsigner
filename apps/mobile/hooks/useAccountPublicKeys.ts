import { skipToken, useQuery } from '@tanstack/react-query'

import { MISSING_PUBKEY_PLACEHOLDER } from '@/constants/account'
import { type Account } from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getAccountWithDecryptedKeys } from '@/utils/decryption'
import { getKeyExtendedPublicKey } from '@/utils/key'

/**
 * Extended public keys of each account key. Keys are decrypted inside the
 * query only; the cache holds public data.
 */
async function fetchAccountPublicKeys(account: Account, network: Network) {
  const decrypted = await getAccountWithDecryptedKeys(account)
  const bdkNetwork = appNetworkToBdkNetwork(network)
  const publicKeys = await Promise.all(
    decrypted.keys.map((key) => getKeyExtendedPublicKey(key, bdkNetwork))
  )
  return publicKeys.map((publicKey) => publicKey || MISSING_PUBKEY_PLACEHOLDER)
}

/**
 * Public keys of an account for export. Decrypts once per mount and drops the
 * cache on unmount, so keys never outlive the screen.
 */
export function useAccountPublicKeys(
  account: Account | undefined,
  network: Network
) {
  return useQuery({
    gcTime: 0,
    queryFn: account
      ? () => fetchAccountPublicKeys(account, network)
      : skipToken,
    queryKey: ['bitcoin', 'account-public-keys', account?.id, network],
    retry: false,
    staleTime: Infinity
  })
}
