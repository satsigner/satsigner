import { useQuery } from '@tanstack/react-query'

import { getWalletData } from '@/api/bdk'
import {
  ACCOUNT_PUBLIC_KEYS_DECRYPT_ONCE_STALE_TIME_MS,
  ACCOUNT_PUBLIC_KEYS_DROP_ON_UNMOUNT_GC_TIME_MS,
  MISSING_PUBKEY_PLACEHOLDER
} from '@/constants/account'
import { type Account } from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getAccountWithDecryptedKeys } from '@/utils/decryption'

/**
 * Extended public keys of each account key. Keys are decrypted inside the
 * query only; the cache holds public data.
 */
async function fetchAccountPublicKeys(account: Account, network: Network) {
  const isImportAddress = account.keys[0]?.creationType === 'importAddress'
  const decrypted = await getAccountWithDecryptedKeys(account)
  if (isImportAddress) {
    return decrypted.keys.map(
      (key) => key.secret.extendedPublicKey || MISSING_PUBKEY_PLACEHOLDER
    )
  }
  const walletData = await getWalletData(
    decrypted,
    appNetworkToBdkNetwork(network)
  )
  const extendedKey = walletData?.externalDescriptor
    ? getExtendedKeyFromDescriptor(walletData.externalDescriptor)
    : undefined
  return decrypted.keys.map(() => extendedKey || MISSING_PUBKEY_PLACEHOLDER)
}

export function useAccountPublicKeys(
  account: Account | undefined,
  network: Network
) {
  return useQuery({
    enabled: Boolean(account),
    gcTime: ACCOUNT_PUBLIC_KEYS_DROP_ON_UNMOUNT_GC_TIME_MS,
    queryFn: () => {
      if (!account) {
        throw new Error('Account is required')
      }
      return fetchAccountPublicKeys(account, network)
    },
    queryKey: ['bitcoin', 'account-public-keys', account?.id, network],
    retry: false,
    staleTime: ACCOUNT_PUBLIC_KEYS_DECRYPT_ONCE_STALE_TIME_MS
  })
}
