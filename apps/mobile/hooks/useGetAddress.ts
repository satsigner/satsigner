import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { Descriptor } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { useShallow } from 'zustand/react/shallow'

import { useAccountsStore } from '@/store/accounts'
import type { Account } from '@/types/models/Account'

export const useGetAddress = (
  id: string
): UseQueryResult<
  { account: Account; address: string; used: boolean; path: string },
  Error
> => {
  const [getCurrentAccount, loadWalletFromDescriptor] = useAccountsStore(
    useShallow((state) => [
      state.getCurrentAccount,
      state.loadWalletFromDescriptor
    ])
  )
  const account = getCurrentAccount(id!)
  const fetchAddressInfo = async (): Promise<{
    address: string
    used: boolean
    path: string
  }> => {
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
      account,
      address: finalAddress,
      used: hasBeenUsed,
      path: account.derivationPath + `/0/` + addr.index
    }
  }
  return useQuery({
    queryKey: ['address'],
    queryFn: fetchAddressInfo,
    enabled: !!account
  })
}
