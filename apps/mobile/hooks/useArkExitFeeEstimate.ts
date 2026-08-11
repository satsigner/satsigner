import { useQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/react/shallow'

import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useArkStore } from '@/store/ark'
import type { ArkVtxo } from '@/types/models/Ark'
import { estimateArkExitFeeSats } from '@/utils/ark'

const EXIT_FEE_ESTIMATE_STALE_MS = 60_000
const EXIT_FEE_RATE_PRIORITY = 'medium' as const

export type ArkExitFeeEstimate = {
  feeSats: number
  feeRateSatPerVb: number
  vtxoCount: number
}

type UseArkExitFeeEstimateArgs = {
  accountId: string | null | undefined
  vtxos: ArkVtxo[]
  enabled: boolean
}

export function useArkExitFeeEstimate({
  accountId,
  vtxos,
  enabled
}: UseArkExitFeeEstimateArgs) {
  const account = useArkStore(
    useShallow((state) => state.accounts.find((a) => a.id === accountId))
  )
  const oracle = useMempoolOracle(account?.network)
  const sortedIds = vtxos.map((vtxo) => vtxo.id).toSorted()

  return useQuery<ArkExitFeeEstimate, Error>({
    enabled: enabled && Boolean(account) && vtxos.length > 0,
    queryFn: async () => {
      const feeRateSatPerVb = await oracle.getCurrentFeeRate(
        EXIT_FEE_RATE_PRIORITY
      )
      return {
        feeRateSatPerVb,
        feeSats: estimateArkExitFeeSats(vtxos, feeRateSatPerVb),
        vtxoCount: vtxos.length
      }
    },
    queryKey: ['ark', 'exit-fee-estimate', accountId, sortedIds],
    retry: false,
    staleTime: EXIT_FEE_ESTIMATE_STALE_MS
  })
}
