import { checkMintQuote, getMintBalance, mintProofs } from '@/api/ecash'
import {
  ECASH_MAX_FAILED_MINT_ATTEMPTS,
  ECASH_PENDING_MINT_MAX_AGE_MS,
  ECASH_PENDING_MINT_TIMEOUT_MS,
  ECASH_UNREACHABLE_MINT_RETRY_MS
} from '@/constants/ecash'
import { getEcashAccountStore } from '@/services/ecash/accountStore'
import { restoreProofsFromMints } from '@/services/ecash/restore'
import {
  getEcashSeed,
  getEcashWalletOptions
} from '@/services/ecash/walletOptions'
import { useEcashStore } from '@/store/ecash'
import type {
  EcashProof,
  MintQuoteState,
  WalletOptions
} from '@/types/models/Ecash'
import { assertNever } from '@/utils/assertNever'
import {
  listPendingMints,
  type PendingMint,
  toPendingMintStep
} from '@/utils/ecashMintQuote'
import { withTimeout } from '@/utils/time'

type PendingMintResult =
  | 'waiting'
  | 'minted'
  | 'mintFailed'
  | 'expired'
  | 'failed'

type PendingMintSettlement = {
  pendingMint: PendingMint
  result: PendingMintResult
}

type MintAnswer =
  | { reachable: true; state: MintQuoteState }
  | { reachable: false }

type ClosedMintStatus = 'completed' | 'expired' | 'failed'

// A quote being checked, minted or recovered is skipped by every other run.
const quoteIdsInProgress = new Set<string>()
const failedMintAttempts = new Map<string, number>()
// Quotes left alone until then: one whose minting kept failing this session,
// or one whose mint stopped answering after its invoice expired.
const quotesRestingUntil = new Map<string, number>()

function isAccountKnown(accountId: string) {
  return useEcashStore.getState().accounts.some(({ id }) => id === accountId)
}

function isDue({ quoteId }: PendingMint, now: number) {
  if (quoteIdsInProgress.has(quoteId)) {
    return false
  }
  return (quotesRestingUntil.get(quoteId) ?? 0) <= now
}

function restQuote(quoteId: string, until: number) {
  const restingUntil = quotesRestingUntil.get(quoteId) ?? 0
  quotesRestingUntil.set(quoteId, Math.max(restingUntil, until))
}

function closeQuote(pendingMint: PendingMint, status: ClosedMintStatus) {
  const { accountId, quoteId, transactionId } = pendingMint
  if (!isAccountKnown(accountId)) {
    return
  }
  const store = useEcashStore.getState()
  store.removeMintQuote(accountId, quoteId)
  store.updateTransaction(accountId, transactionId, { status })
}

async function askMint(
  { accountId, mintUrl, quoteId }: PendingMint,
  options: WalletOptions
): Promise<MintAnswer> {
  try {
    const state = await checkMintQuote(accountId, mintUrl, quoteId, options)
    return { reachable: true, state }
  } catch {
    return { reachable: false }
  }
}

/**
 * A mint that does not answer is asked again on the next run. Past the
 * invoice deadline it is asked rarely, and once a whole extra day has passed
 * the invoice is given up as expired.
 */
function settleUnreachableMint(
  pendingMint: PendingMint,
  now: number
): PendingMintResult {
  const { deadline, quoteId } = pendingMint
  if (now > deadline + ECASH_PENDING_MINT_MAX_AGE_MS) {
    closeQuote(pendingMint, 'expired')
    return 'expired'
  }
  if (now > deadline) {
    restQuote(quoteId, now + ECASH_UNREACHABLE_MINT_RETRY_MS)
  }
  return 'waiting'
}

function storeMintedProofs(pendingMint: PendingMint, proofs: EcashProof[]) {
  const { accountId, mintUrl } = pendingMint
  if (!isAccountKnown(accountId)) {
    return
  }
  const store = useEcashStore.getState()
  store.addProofs(accountId, proofs)
  const accountProofs = useEcashStore.getState().proofs[accountId] ?? []
  store.updateMintBalance(
    accountId,
    mintUrl,
    getMintBalance(mintUrl, accountProofs)
  )
  closeQuote(pendingMint, 'completed')
}

/**
 * Every mint attempt reserves seed counters, so a quote whose minting keeps
 * failing rests until the next launch instead of widening the counter gap.
 */
function recordFailedMint(quoteId: string): PendingMintResult {
  const failures = (failedMintAttempts.get(quoteId) ?? 0) + 1
  failedMintAttempts.set(quoteId, failures)
  if (failures < ECASH_MAX_FAILED_MINT_ATTEMPTS) {
    return 'waiting'
  }
  restQuote(quoteId, Number.POSITIVE_INFINITY)
  return 'mintFailed'
}

async function mintPaidQuote(
  pendingMint: PendingMint,
  options: WalletOptions
): Promise<PendingMintResult> {
  const { accountId, amount, mintUrl, quoteId } = pendingMint
  try {
    const { proofs } = await mintProofs(
      accountId,
      mintUrl,
      amount,
      quoteId,
      options
    )
    failedMintAttempts.delete(quoteId)
    storeMintedProofs(pendingMint, proofs)
    return 'minted'
  } catch {
    return recordFailedMint(quoteId)
  }
}

/**
 * The mint signed this quote's proofs but they never reached the wallet, as
 * when the response to a mint request is lost. A seeded account derives
 * them from its seed, so restoring that mint brings them in.
 */
async function recoverIssuedQuote(
  pendingMint: PendingMint
): Promise<PendingMintResult> {
  const { accountId, mintUrl } = pendingMint
  const seed = await getEcashSeed(accountId)
  if (!seed) {
    closeQuote(pendingMint, 'failed')
    return 'failed'
  }
  const { mintsFailed } = await restoreProofsFromMints(
    accountId,
    [mintUrl],
    seed,
    getEcashAccountStore(accountId)
  )
  if (mintsFailed > 0) {
    return 'waiting'
  }
  closeQuote(pendingMint, 'completed')
  return 'minted'
}

async function advancePendingMint(
  pendingMint: PendingMint,
  now: number
): Promise<PendingMintResult> {
  const options = await getEcashWalletOptions(pendingMint.accountId)
  const answer = await askMint(pendingMint, options)
  if (!answer.reachable) {
    return settleUnreachableMint(pendingMint, now)
  }
  const step = toPendingMintStep(answer.state, pendingMint.deadline, now)
  switch (step) {
    case 'wait': {
      return 'waiting'
    }
    case 'mint': {
      return mintPaidQuote(pendingMint, options)
    }
    case 'recover': {
      return recoverIssuedQuote(pendingMint)
    }
    case 'expire': {
      closeQuote(pendingMint, 'expired')
      return 'expired'
    }
    case 'fail': {
      closeQuote(pendingMint, 'failed')
      return 'failed'
    }
    default: {
      return assertNever(step)
    }
  }
}

async function advanceAndRelease(
  pendingMint: PendingMint,
  now: number
): Promise<PendingMintResult> {
  try {
    return await advancePendingMint(pendingMint, now)
  } catch {
    return 'waiting'
  } finally {
    quoteIdsInProgress.delete(pendingMint.quoteId)
  }
}

async function settlePendingMint(
  pendingMint: PendingMint,
  now: number
): Promise<PendingMintResult> {
  quoteIdsInProgress.add(pendingMint.quoteId)
  try {
    // A hung mint keeps its own quote locked but must not hold up the rest.
    return await withTimeout(
      advanceAndRelease(pendingMint, now),
      ECASH_PENDING_MINT_TIMEOUT_MS
    )
  } catch {
    return 'waiting'
  }
}

/**
 * Checks every due pending mint invoice once, on every account, and mints
 * the paid ones into the account that created them.
 */
function settlePendingMints(): Promise<PendingMintSettlement[]> {
  const now = Date.now()
  const dueMints = listPendingMints(useEcashStore.getState()).filter(
    (pendingMint) => isDue(pendingMint, now)
  )
  return Promise.all(
    dueMints.map(async (pendingMint) => ({
      pendingMint,
      result: await settlePendingMint(pendingMint, now)
    }))
  )
}

export { type PendingMintResult, settlePendingMints }
