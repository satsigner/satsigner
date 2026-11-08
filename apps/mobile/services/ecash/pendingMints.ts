import { checkMintQuote, getMintBalance, mintProofs } from '@/api/ecash'
import { ECASH_MAX_FAILED_MINT_ATTEMPTS } from '@/constants/ecash'
import { getEcashWalletOptions } from '@/services/ecash/walletOptions'
import { useEcashStore } from '@/store/ecash'
import type { EcashTransaction, WalletOptions } from '@/types/models/Ecash'
import { assertNever } from '@/utils/assertNever'
import {
  listPendingMints,
  type PendingMint,
  toPendingMintStep
} from '@/utils/ecashMintQuote'

type PendingMintResult = 'waiting' | 'minted' | 'expired' | 'failed'

type PendingMintSettlement = {
  pendingMint: PendingMint
  result: PendingMintResult
}

// A quote being checked or minted is skipped by any concurrent run.
const quoteIdsInProgress = new Set<string>()
const failedMintAttempts = new Map<string, number>()

function isAccountKnown(accountId: string) {
  return useEcashStore.getState().accounts.some(({ id }) => id === accountId)
}

function canAttemptMint(quoteId: string) {
  const failures = failedMintAttempts.get(quoteId) ?? 0
  return failures < ECASH_MAX_FAILED_MINT_ATTEMPTS
}

function markTransaction(
  { accountId, transactionId }: PendingMint,
  status: NonNullable<EcashTransaction['status']>
) {
  if (!isAccountKnown(accountId)) {
    return
  }
  useEcashStore.getState().updateTransaction(accountId, transactionId, {
    status
  })
}

async function requestProofs(pendingMint: PendingMint, options: WalletOptions) {
  const { accountId, amount, mintUrl, quoteId } = pendingMint
  try {
    return await mintProofs(accountId, mintUrl, amount, quoteId, options)
  } catch (error) {
    failedMintAttempts.set(quoteId, (failedMintAttempts.get(quoteId) ?? 0) + 1)
    throw error
  }
}

async function mintPaidQuote(
  pendingMint: PendingMint,
  options: WalletOptions
): Promise<PendingMintResult> {
  const { accountId, mintUrl, quoteId } = pendingMint
  if (!canAttemptMint(quoteId)) {
    return 'waiting'
  }
  const { proofs } = await requestProofs(pendingMint, options)
  failedMintAttempts.delete(quoteId)
  if (!isAccountKnown(accountId)) {
    return 'minted'
  }
  const store = useEcashStore.getState()
  store.addProofs(accountId, proofs)
  store.removeMintQuote(accountId, quoteId)
  const accountProofs = useEcashStore.getState().proofs[accountId] ?? []
  store.updateMintBalance(
    accountId,
    mintUrl,
    getMintBalance(mintUrl, accountProofs)
  )
  markTransaction(pendingMint, 'completed')
  return 'minted'
}

async function advancePendingMint(
  pendingMint: PendingMint,
  now: number
): Promise<PendingMintResult> {
  const { accountId, deadline, mintUrl, quoteId } = pendingMint
  const options = await getEcashWalletOptions(accountId)
  const state = await checkMintQuote(accountId, mintUrl, quoteId, options)
  const step = toPendingMintStep(state, deadline, now)
  switch (step) {
    case 'wait': {
      return 'waiting'
    }
    case 'mint': {
      return mintPaidQuote(pendingMint, options)
    }
    case 'expire': {
      markTransaction(pendingMint, 'expired')
      return 'expired'
    }
    case 'fail': {
      markTransaction(pendingMint, 'failed')
      return 'failed'
    }
    default: {
      return assertNever(step)
    }
  }
}

async function settlePendingMint(
  pendingMint: PendingMint,
  now: number
): Promise<PendingMintResult> {
  const { quoteId } = pendingMint
  if (quoteIdsInProgress.has(quoteId)) {
    return 'waiting'
  }
  quoteIdsInProgress.add(quoteId)
  try {
    return await advancePendingMint(pendingMint, now)
  } catch {
    // An unreachable mint is asked again on the next run.
    return 'waiting'
  } finally {
    quoteIdsInProgress.delete(quoteId)
  }
}

/**
 * Checks every pending mint invoice once, on every account, and mints the
 * paid ones into the account that created them.
 */
function settlePendingMints(): Promise<PendingMintSettlement[]> {
  const now = Date.now()
  const pendingMints = listPendingMints(useEcashStore.getState())
  return Promise.all(
    pendingMints.map(async (pendingMint) => ({
      pendingMint,
      result: await settlePendingMint(pendingMint, now)
    }))
  )
}

export { type PendingMintResult, settlePendingMints }
