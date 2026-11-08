import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchArkOnchainFeeRate, listArkOnchainUtxos } from '@/api/ark'
import { ARK_QUERY_STALE_TIME_MS } from '@/constants/ark'
import { sweepArkOnchainWallet } from '@/services/arkOnchainSweep'
import { getArkAccountOrThrow } from '@/store/ark'
import { computeArkOnchainSweep } from '@/utils/arkOnchainSweep'

import {
  arkOnchainSpendMutationKey,
  invalidateArkBoardQueries,
  useArkOnchainBalance
} from './useArkBoard'
import { useArkWallet } from './useArkWallet'

export function useArkOnchainSweepPreview(accountId: string | undefined) {
  const { data: walletReady } = useArkWallet(accountId)
  const { data: onchainBalance } = useArkOnchainBalance(accountId)
  return useQuery({
    enabled: Boolean(walletReady && accountId),
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      const { serverId } = getArkAccountOrThrow(accountId)
      const [utxos, feeRateSatPerVb] = await Promise.all([
        listArkOnchainUtxos(serverId, accountId),
        fetchArkOnchainFeeRate(serverId, accountId)
      ])
      return {
        feeRateSatPerVb,
        sweep: computeArkOnchainSweep({ feeRateSatPerVb, utxos })
      }
    },
    // Keyed on the balance so a new deposit refreshes the preview.
    queryKey: [
      'ark',
      'onchain-sweep-preview',
      accountId,
      onchainBalance?.confirmedSats,
      onchainBalance?.pendingSats
    ],
    staleTime: ARK_QUERY_STALE_TIME_MS
  })
}

export function useArkOnchainSweep(accountId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      destinationAccountId,
      feeRateSatPerVb
    }: {
      destinationAccountId: string
      feeRateSatPerVb: number
    }) => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      return sweepArkOnchainWallet({
        arkAccountId: accountId,
        destinationAccountId,
        feeRateSatPerVb
      })
    },
    mutationKey: [...arkOnchainSpendMutationKey(accountId), 'sweep'],
    onSuccess: () => {
      if (!accountId) {
        return
      }
      queryClient.invalidateQueries({
        queryKey: ['ark', 'onchain-sweep-preview', accountId]
      })
      invalidateArkBoardQueries(queryClient, accountId)
    }
  })
}
