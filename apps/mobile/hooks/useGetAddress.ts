import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { Descriptor } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'

import { useGetAccount } from '@/hooks/useGetAccount'
import { useAccountsStore } from '@/store/accounts'

export const useGetAddress = (
  id: string
): UseQueryResult<{ address: string; used: boolean; path: string }, Error> => {
  const { data: account, isLoading, error } = useGetAccount(id)
  const loadWalletFromDescriptor = useAccountsStore().loadWalletFromDescriptor
  const fetchAddressInfo = async (): {
    address: string
    used: boolean
    path: string
  } => {
    const wallet = await loadWalletFromDescriptor(
      await new Descriptor().create(
        account.externalDescriptor,
        Network.Testnet
      ),
      await new Descriptor().create(account.internalDescriptor, Network.Testnet)
    )
    const addr = await wallet.getAddress(account.currentIndex)
    const finalAddress = await addr.address.asString()

    const hasBeenUsed =
      account.usedIndexes.findIndex(
        (index: number) => index === account.currentIndex
      ) !== -1
    return {
      address: finalAddress,
      used: hasBeenUsed,
      path: account.derivationPath + `/0/` + addr.index
    }
  }
  return useQuery({
    queryKey: ['address'],
    queryFn: fetchAddressInfo,
    enabled: !isLoading && !error && !!account
  })
}
