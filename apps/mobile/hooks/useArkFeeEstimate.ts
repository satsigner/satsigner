import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { estimateArkFee } from '@/api/ark'
import { useArkWallet } from '@/hooks/useArkWallet'
import type { ArkFeeEstimate, ArkFeeRequest } from '@/types/models/Ark'
import {
  getArkAccountOrThrow,
  isArkFeeRequestReady,
  normalizeArkFeeRequest
} from '@/utils/ark'

const ARK_FEE_ESTIMATE_STALE_MS = 30_000

type UseArkFeeEstimateArgs = {
  accountId: string | null | undefined
  /** `null` disables the query (e.g. no destination yet). */
  request: ArkFeeRequest | null
  enabled?: boolean
  /** Keep showing the last quote while inputs change (e.g. typing an amount). */
  keepPrevious?: boolean
}

/** Quotes the fee of any Ark operation (send, board, offboard, refresh). */
export function useArkFeeEstimate({
  accountId,
  request,
  enabled = true,
  keepPrevious = false
}: UseArkFeeEstimateArgs) {
  const { data: walletReady } = useArkWallet(accountId)
  const normalized = request ? normalizeArkFeeRequest(request) : null

  return useQuery<ArkFeeEstimate, Error>({
    enabled:
      enabled &&
      Boolean(walletReady && accountId) &&
      normalized !== null &&
      isArkFeeRequestReady(normalized),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    queryFn: () => {
      if (!accountId || !normalized) {
        throw new Error('Ark fee estimate requires an account and a request')
      }
      const account = getArkAccountOrThrow(accountId)
      return estimateArkFee(account.serverId, accountId, normalized)
    },
    queryKey: ['ark', 'fee-estimate', accountId, normalized],
    retry: false,
    staleTime: ARK_FEE_ESTIMATE_STALE_MS
  })
}
