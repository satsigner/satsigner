import { useQuery } from '@tanstack/react-query'

import { getWalletData } from '@/api/bdk'
import { type Account } from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getAccountWithDecryptedKeys } from '@/utils/decryption'

const MISSING_PUBKEY = 'N/A'

/**
 * Extended public keys of each account key. Keys are decrypted inside the
 * query only; the cache holds public data.
 */
async function fetchAccountPublicKeys(account: Account, network: Network) {
  const isImportAddress = account.keys[0]?.creationType === 'importAddress'
  const decrypted = await getAccountWithDecryptedKeys(account)
  if (isImportAddress) {
    return decrypted.keys.map(
      (key) => key.secret.extendedPublicKey || MISSING_PUBKEY
    )
  }
  const walletData = await getWalletData(
    decrypted,
    appNetworkToBdkNetwork(network)
  )
  const extendedKey = walletData?.externalDescriptor
    ? getExtendedKeyFromDescriptor(walletData.externalDescriptor)
    : undefined
  return decrypted.keys.map(() => extendedKey || MISSING_PUBKEY)
}

export function useAccountPublicKeys(
  account: Account | undefined,
  network: Network
) {
  return useQuery({
    enabled: Boolean(account),
    queryFn: () => {
      if (!account) {
        throw new Error('Account is required')
      }
      return fetchAccountPublicKeys(account, network)
    },
    queryKey: ['bitcoin', 'account-public-keys', account?.id, network],
    // Decrypts keys: do it once per cache lifetime, and don't retry a failure.
    retry: false,
    staleTime: Infinity
  })
}
