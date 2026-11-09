import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner-native'

import { ECASH_PENDING_MELT_POLL_INTERVAL_MS } from '@/constants/ecash'
import { t } from '@/locales'
import {
  type PendingMeltResult,
  settlePendingMelts
} from '@/services/ecash/pendingMelts'
import {
  type PendingMintResult,
  settlePendingMints
} from '@/services/ecash/pendingMints'
import { useEcashStore } from '@/store/ecash'
import { hasPendingMelts } from '@/utils/ecashMelt'
import {
  hasPendingMints,
  listPendingMints,
  pendingMintPollInterval
} from '@/utils/ecashMintQuote'

const ECASH_PENDING_MINT_RUNNER_QUERY_KEY = ['ecash', 'pendingMintRunner']
const ECASH_PENDING_MELT_RUNNER_QUERY_KEY = ['ecash', 'pendingMeltRunner']

function announcePendingMintResult(result: PendingMintResult) {
  if (result === 'minted') {
    toast.success(t('ecash.success.paymentReceived'))
  }
  if (result === 'mintFailed') {
    toast.error(t('ecash.error.paidInvoiceNotMinted'))
  }
}

async function settleAndAnnouncePendingMints() {
  const settlements = await settlePendingMints()
  for (const { result } of settlements) {
    announcePendingMintResult(result)
  }
  return settlements
}

function announcePendingMeltResult(result: PendingMeltResult) {
  if (result === 'paid') {
    toast.success(t('ecash.success.pendingMeltPaid'))
  }
  if (result === 'released') {
    toast.info(t('ecash.info.pendingMeltReleased'))
  }
}

async function settleAndAnnouncePendingMelts() {
  const results = await settlePendingMelts()
  for (const result of results) {
    announcePendingMeltResult(result)
  }
  return results
}

function nextPendingMintPoll() {
  return pendingMintPollInterval(
    listPendingMints(useEcashStore.getState()),
    Date.now()
  )
}

/**
 * Settles pending Lightning payments of every account, releasing the reserved
 * proofs of failed ones. Never invalidate or refetch it from outside.
 */
function useEcashPendingMeltRunner() {
  const hasPending = useEcashStore(hasPendingMelts)
  return useQuery({
    enabled: hasPending,
    queryFn: settleAndAnnouncePendingMelts,
    queryKey: ECASH_PENDING_MELT_RUNNER_QUERY_KEY,
    refetchInterval: ECASH_PENDING_MELT_POLL_INTERVAL_MS,
    retry: false
  })
}

/**
 * Mints paid ecash invoices of every account, whichever screen is open, and
 * settles pending Lightning payments. The query functions move proofs, so
 * never invalidate or refetch them from outside.
 */
export function useEcashPendingMintRunner() {
  useEcashPendingMeltRunner()
  const hasPending = useEcashStore(hasPendingMints)
  return useQuery({
    enabled: hasPending,
    queryFn: settleAndAnnouncePendingMints,
    queryKey: ECASH_PENDING_MINT_RUNNER_QUERY_KEY,
    refetchInterval: nextPendingMintPoll,
    retry: false
  })
}
