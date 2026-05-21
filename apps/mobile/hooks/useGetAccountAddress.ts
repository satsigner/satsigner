import { useQuery } from '@tanstack/react-query'
import { KeychainKind } from 'react-native-bdk-sdk'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'

async function deriveAccountAddress(
  account: Account,
  network: Network
): Promise<string> {
  const temporaryAccount = await getAccountWithDecryptedKeys(account)

  if (account.keys[0].creationType === 'importAddress') {
    const [{ secret }] = temporaryAccount.keys
    if (!secret.externalDescriptor) {
      return ''
    }
    return secret.externalDescriptor.startsWith('addr(') &&
      secret.externalDescriptor.endsWith(')')
      ? secret.externalDescriptor.slice(5, -1)
      : secret.externalDescriptor
  }

  const walletData = await getWalletData(
    temporaryAccount,
    appNetworkToBdkNetwork(network)
  )
  if (!walletData) {
    return ''
  }
  const addressInfo = walletData.wallet.peekAddress(KeychainKind.External, 0)
  return addressInfo?.address ?? ''
}

const useGetAccountAddress = (id: Account['id']) => {
  const [storedAddress, addAccountAddress] = useWalletsStore(
    useShallow((state) => [state.addresses[id], state.addAccountAddress])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )

  const network = useBlockchainStore((state) => state.selectedNetwork)

  const fingerprint = account?.keys?.[0]?.fingerprint
  const hasKeys = (account?.keys?.length ?? 0) > 0

  const { data } = useQuery({
    enabled: !storedAddress && Boolean(account) && hasKeys,
    queryFn: async () => {
      const derived = await deriveAccountAddress(account as Account, network)
      if (derived) {
        addAccountAddress(id, derived)
      }
      return derived
    },
    queryKey: ['accountAddress', id, network, fingerprint],
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  })

  return storedAddress ?? data
}

export default useGetAccountAddress
