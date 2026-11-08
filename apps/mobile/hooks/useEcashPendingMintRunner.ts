import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { settlePendingMints } from '@/services/ecash/pendingMints'
import { useEcashStore } from '@/store/ecash'
import {
  hasPendingMints,
  listPendingMints,
  pendingMintPollInterval
} from '@/utils/ecashMintQuote'

const ECASH_PENDING_MINT_RUNNER_QUERY_KEY = ['ecash', 'pendingMintRunner']

async function settleAndAnnouncePendingMints() {
  const settlements = await settlePendingMints()
  for (const { result } of settlements) {
    if (result === 'minted') {
      toast.success(t('ecash.success.paymentReceived'))
    }
  }
  return settlements
}

function nextPendingMintPoll() {
  return pendingMintPollInterval(
    listPendingMints(useEcashStore.getState()),
    Date.now()
  )
}

/**
 * Mints paid ecash invoices of every account, whichever screen is open. The
 * query function mints proofs, so never invalidate or refetch it from outside.
 */
export function useEcashPendingMintRunner() {
  const hasPending = useEcashStore(hasPendingMints)
  return useQuery({
    enabled: hasPending,
    queryFn: settleAndAnnouncePendingMints,
    queryKey: ECASH_PENDING_MINT_RUNNER_QUERY_KEY,
    refetchInterval: nextPendingMintPoll,
    retry: false
  })
}
