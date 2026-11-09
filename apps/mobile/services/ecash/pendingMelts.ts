import { checkMeltQuoteState, getMintBalance } from '@/api/ecash'
import { ECASH_PENDING_MELT_TIMEOUT_MS } from '@/constants/ecash'
import { getEcashWalletOptions } from '@/services/ecash/walletOptions'
import { useEcashStore } from '@/store/ecash'
import type { EcashMeltResult } from '@/types/models/Ecash'
import { assertNever } from '@/utils/assertNever'
import { listPendingMelts, type PendingMelt } from '@/utils/ecashMelt'
import { withTimeout } from '@/utils/time'

type PendingMeltResult = 'waiting' | 'paid' | 'released'

const quoteIdsInProgress = new Set<string>()

function isAccountKnown(accountId: string) {
  return useEcashStore.getState().accounts.some(({ id }) => id === accountId)
}

function markPaid({ accountId, transactionId }: PendingMelt) {
  useEcashStore.getState().updateTransaction(accountId, transactionId, {
    reservedProofs: undefined,
    status: 'settled'
  })
}

/** A failed payment frees its reserved proofs at the mint, so they are spendable again. */
function releaseReservedProofs({
  accountId,
  mintUrl,
  reservedProofs,
  transactionId
}: PendingMelt) {
  const store = useEcashStore.getState()
  store.addProofs(accountId, reservedProofs)
  const accountProofs = useEcashStore.getState().proofs[accountId] ?? []
  store.updateMintBalance(
    accountId,
    mintUrl,
    getMintBalance(mintUrl, accountProofs)
  )
  store.updateTransaction(accountId, transactionId, {
    reservedProofs: undefined,
    status: 'failed'
  })
}

async function askMint({
  accountId,
  mintUrl,
  quoteId
}: PendingMelt): Promise<EcashMeltResult['status']> {
  const options = await getEcashWalletOptions(accountId)
  try {
    return await checkMeltQuoteState(accountId, mintUrl, quoteId, options)
  } catch {
    return 'pending'
  }
}

async function advancePendingMelt(
  pendingMelt: PendingMelt
): Promise<PendingMeltResult> {
  const status = await askMint(pendingMelt)
  if (!isAccountKnown(pendingMelt.accountId)) {
    return 'waiting'
  }
  switch (status) {
    case 'pending': {
      return 'waiting'
    }
    case 'paid': {
      markPaid(pendingMelt)
      return 'paid'
    }
    case 'unpaid': {
      releaseReservedProofs(pendingMelt)
      return 'released'
    }
    default: {
      return assertNever(status)
    }
  }
}

async function advanceAndRelease(
  pendingMelt: PendingMelt
): Promise<PendingMeltResult> {
  try {
    return await advancePendingMelt(pendingMelt)
  } catch {
    return 'waiting'
  } finally {
    quoteIdsInProgress.delete(pendingMelt.quoteId)
  }
}

async function settlePendingMelt(
  pendingMelt: PendingMelt
): Promise<PendingMeltResult> {
  quoteIdsInProgress.add(pendingMelt.quoteId)
  try {
    return await withTimeout(
      advanceAndRelease(pendingMelt),
      ECASH_PENDING_MELT_TIMEOUT_MS
    )
  } catch {
    return 'waiting'
  }
}

/**
 * Asks the mint about every pending Lightning payment once. A paid one is
 * settled; a failed one returns its reserved proofs to the balance.
 */
function settlePendingMelts(): Promise<PendingMeltResult[]> {
  const dueMelts = listPendingMelts(useEcashStore.getState()).filter(
    ({ quoteId }) => !quoteIdsInProgress.has(quoteId)
  )
  return Promise.all(dueMelts.map(settlePendingMelt))
}

export { type PendingMeltResult, settlePendingMelts }
