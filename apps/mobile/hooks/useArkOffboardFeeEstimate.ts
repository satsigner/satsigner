import { useQuery } from '@tanstack/react-query'

import { estimateArkOffboardFee } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { ArkFeeEstimate } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { validateAddress } from '@/utils/validation'

import { useArkWallet } from './useArkWallet'

type UseArkOffboardFeeEstimateArgs = {
  accountId: string | null | undefined
  network: Network | undefined
  bitcoinAddress: string
  vtxoIds: string[]
}

export function useArkOffboardFeeEstimate({
  accountId,
  network,
  bitcoinAddress,
  vtxoIds
}: UseArkOffboardFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)
  const trimmedAddress = bitcoinAddress.trim()
  const addressValid =
    trimmedAddress.length > 0 &&
    network !== undefined &&
    validateAddress(trimmedAddress, bitcoinjsNetwork(network))
  const sortedIds = [...vtxoIds].toSorted()

  return useQuery<ArkFeeEstimate, Error>({
    enabled:
      Boolean(walletReady && accountId) && addressValid && sortedIds.length > 0,
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const { accounts } = useArkStore.getState()
      const account = accounts.find((a) => a.id === accountId)
      if (!account) {
        throw new Error('Ark account not found')
      }
      return estimateArkOffboardFee(
        account.serverId,
        accountId,
        trimmedAddress,
        sortedIds
      )
    },
    queryKey: [
      'ark',
      'offboard-fee-estimate',
      accountId,
      trimmedAddress,
      sortedIds
    ],
    retry: false,
    staleTime: 30_000
  })
}
