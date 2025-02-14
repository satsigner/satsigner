import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { useCallback } from 'react'

import { getLastUnusedWalletAddress } from '@/api/bdk'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'

function useGetWalletAddress(account: Account) {
  const loadWalletFromDescriptor = useAccountsStore(
    (state) => state.loadWalletFromDescriptor
  )
  const network = useBlockchainStore((state) => state.network)

  const getWalletAddress = useCallback(async () => {
    if (!account.externalDescriptor || !account.internalDescriptor) return

    const [externalDescriptor, internalDescriptor] = await Promise.all([
      new Descriptor().create(account.externalDescriptor, network as Network),
      new Descriptor().create(account.internalDescriptor, network as Network)
    ])

    const wallet = await loadWalletFromDescriptor(
      externalDescriptor,
      internalDescriptor
    )

    return getLastUnusedWalletAddress(
      wallet,
      account.summary.numberOfAddresses - 1
    )
  }, [
    account.externalDescriptor,
    account.internalDescriptor,
    network,
    loadWalletFromDescriptor,
    account.summary.numberOfAddresses
  ])

  return getWalletAddress
}

export default useGetWalletAddress
