import { checkMintQuote, getMintBalance, mintProofs } from '@/api/ecash'
import {
  ECASH_INCOMPLETE_RESTORE_RETRY_MS,
  ECASH_MAX_FAILED_MINT_ATTEMPTS,
  ECASH_PENDING_MINT_TIMEOUT_MS,
  ECASH_UNREACHABLE_MINT_RETRY_MS
} from '@/constants/ecash'
import { getEcashAccountStore } from '@/services/ecash/accountStore'
import {
  type RestoreSummary,
  restoreProofsFromMints
} from '@/services/ecash/restore'
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
// one whose mint stopped answering after its invoice expired, or one whose
// recovery could not scan the whole mint.
const quotesRestingUntil = new Map<string, number>()
// Several lost quotes on one mint share a single seed scan of it.
const mintRestoresInProgress = new Map<string, Promise<RestoreSummary>>()

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
 * A mint that does not answer is asked again on the next run, and past the
 * invoice deadline only rarely. Silence never expires a quote: the invoice
 * may have been paid while this phone was offline.
 */
function settleUnreachableMint(
  { deadline, quoteId }: PendingMint,
  now: number
): PendingMintResult {
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

async function restoreAndRelease(
  key: string,
  accountId: string,
  mintUrl: string,
  seed: Uint8Array
): Promise<RestoreSummary> {
  try {
    return await restoreProofsFromMints(
      accountId,
      [mintUrl],
      seed,
      getEcashAccountStore(accountId)
    )
  } finally {
    mintRestoresInProgress.delete(key)
  }
}

function restoreMintOnce(
  accountId: string,
  mintUrl: string,
  seed: Uint8Array
): Promise<RestoreSummary> {
  const key = `${accountId}:${mintUrl}`
  const running = mintRestoresInProgress.get(key)
  if (running) {
    return running
  }
  const restore = restoreAndRelease(key, accountId, mintUrl, seed)
  mintRestoresInProgress.set(key, restore)
  return restore
}

/**
 * The mint signed this quote's proofs but they never reached the wallet, as
 * when the response to a mint request is lost. A seeded account derives
 * them from its seed, so restoring that mint brings them in. A scan that
 * could not reach every keyset may have missed them, so it is tried again.
 */
async function recoverIssuedQuote(
  pendingMint: PendingMint,
  now: number
): Promise<PendingMintResult> {
  const { accountId, mintUrl, quoteId } = pendingMint
  const seed = await getEcashSeed(accountId)
  if (!seed) {
    closeQuote(pendingMint, 'failed')
    return 'failed'
  }
  const { mintsFailed, mintsIncomplete } = await restoreMintOnce(
    accountId,
    mintUrl,
    seed
  )
  if (mintsFailed > 0 || mintsIncomplete > 0) {
    restQuote(quoteId, now + ECASH_INCOMPLETE_RESTORE_RETRY_MS)
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
      return recoverIssuedQuote(pendingMint, now)
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
