import {
  createMppMeltQuote,
  getMintBalance,
  mintSupportsBolt11Mpp
} from '@/api/ecash'
import { MAX_MPP_FEE_SLICE_ATTEMPTS } from '@/constants/ecash'
import type {
  EcashMint,
  EcashPaymentFailure,
  EcashProof,
  MeltQuote,
  WalletOptions
} from '@/types/models/Ecash'
import {
  coveringMintUrls,
  type MintSpendBalance,
  mintCoversMeltQuote,
  sliceAmountAfterFeeMiss
} from '@/utils/ecashMintRoute'
import { toError } from '@/utils/error'

/** A Lightning payment from ecash could not be routed or fully settled. */
class EcashPaymentError extends Error {
  readonly failure: EcashPaymentFailure

  constructor(failure: EcashPaymentFailure, options?: ErrorOptions) {
    super(failure.reason, options)
    this.name = 'EcashPaymentError'
    this.failure = failure
  }
}

type PlannedQuote = { mintUrl: string; quote: MeltQuote }

type PayInvoiceParams = {
  accountId: string
  invoice: string
  amountSats: number
  selectedMintUrl: string | null
  mints: EcashMint[]
  options: WalletOptions
  getProofs: () => EcashProof[]
  createAndRecordMeltQuote: (
    mintUrl: string,
    invoice: string
  ) => Promise<MeltQuote>
  meltProofsAndUpdateStore: (
    mintUrl: string,
    quote: MeltQuote,
    proofs: EcashProof[]
  ) => Promise<unknown>
  addMeltQuote: (quote: MeltQuote) => void
  removeMeltQuote: (quoteId: string) => void
}

type PaymentRoute = PayInvoiceParams & {
  mintBalances: MintSpendBalance[]
  quoteErrors: Error[]
}

type SliceAttempt = {
  remainingSats: number
  take: number
  attemptsLeft: number
}

/** Quote creation is expected to fail on some mints; report it as a value. */
async function settleQuote<T>(promise: Promise<T>) {
  try {
    return { ok: true as const, quote: await promise }
  } catch (error) {
    return { error: toError(error), ok: false as const }
  }
}

function rethrowQuoteError(error: Error): never {
  throw new Error(error.message, { cause: error })
}

function proofsForMint(proofs: EcashProof[], mintUrl: string) {
  return proofs.filter((proof) => proof.mintUrl === mintUrl)
}

function getMintBalances(
  { accountId, mints, options }: PayInvoiceParams,
  proofs: EcashProof[]
): Promise<MintSpendBalance[]> {
  return Promise.all(
    mints.map(async (mint) => ({
      balance: getMintBalance(mint.url, proofs),
      mintUrl: mint.url,
      supportsMpp: await mintSupportsBolt11Mpp(
        accountId,
        mint.url,
        options
      ).catch(() => false)
    }))
  )
}

/** Pays from the first mint whose quote fits its balance; false if none. */
async function payFromCoveringMint(
  route: PaymentRoute,
  mintUrls: string[],
  startProofs: EcashProof[]
) {
  for (const mintUrl of mintUrls) {
    const quoteResult = await settleQuote(
      route.createAndRecordMeltQuote(mintUrl, route.invoice)
    )
    if (!quoteResult.ok) {
      route.quoteErrors.push(quoteResult.error)
      continue
    }
    const { quote } = quoteResult
    const balance =
      route.mintBalances.find((mint) => mint.mintUrl === mintUrl)?.balance ?? 0
    if (!mintCoversMeltQuote(balance, quote)) {
      route.removeMeltQuote(quote.quote)
      continue
    }
    await route.meltProofsAndUpdateStore(
      mintUrl,
      quote,
      proofsForMint(startProofs, mintUrl)
    )
    return true
  }
  return false
}

/** Quotes an MPP slice the mint can pay, shrinking it after each fee miss. */
async function quoteCoveredSlice(
  route: PaymentRoute,
  mint: MintSpendBalance,
  { remainingSats, take, attemptsLeft }: SliceAttempt
): Promise<MeltQuote | null> {
  if (take <= 0 || attemptsLeft <= 0) {
    return null
  }
  const quoteResult = await settleQuote(
    createMppMeltQuote(
      route.accountId,
      mint.mintUrl,
      route.invoice,
      take,
      route.options
    )
  )
  if (!quoteResult.ok) {
    route.quoteErrors.push(quoteResult.error)
    return null
  }
  const { quote } = quoteResult
  if (mintCoversMeltQuote(mint.balance, quote)) {
    return quote
  }
  const nextTake = sliceAmountAfterFeeMiss(
    mint.balance,
    remainingSats,
    quote.fee_reserve
  )
  if (nextTake <= 0 || nextTake >= take) {
    return null
  }
  return quoteCoveredSlice(route, mint, {
    attemptsLeft: attemptsLeft - 1,
    remainingSats,
    take: nextTake
  })
}

/** One quote per MPP mint, largest balance first, until the amount is met. */
async function planMppQuotes(
  route: PaymentRoute,
  mintsLeft: MintSpendBalance[],
  remainingSats: number,
  planned: PlannedQuote[]
): Promise<PlannedQuote[]> {
  const [mint, ...rest] = mintsLeft
  if (remainingSats <= 0 || !mint) {
    return planned
  }
  const quote = await quoteCoveredSlice(route, mint, {
    attemptsLeft: MAX_MPP_FEE_SLICE_ATTEMPTS,
    remainingSats,
    take: Math.min(mint.balance, remainingSats)
  })
  if (!quote) {
    return planMppQuotes(route, rest, remainingSats, planned)
  }
  return planMppQuotes(route, rest, remainingSats - quote.amount, [
    ...planned,
    { mintUrl: mint.mintUrl, quote }
  ])
}

function removePlannedQuotes(route: PaymentRoute, quotes: PlannedQuote[]) {
  for (const item of quotes) {
    route.removeMeltQuote(item.quote.quote)
  }
}

/**
 * Melts the planned quotes in order. When a part fails after another one
 * settled, throws `EcashPaymentError` with how many parts were paid.
 */
async function meltPlannedQuotes(
  route: PaymentRoute,
  plannedQuotes: PlannedQuote[]
) {
  for (const [index, item] of plannedQuotes.entries()) {
    try {
      await route.meltProofsAndUpdateStore(
        item.mintUrl,
        item.quote,
        proofsForMint(route.getProofs(), item.mintUrl)
      )
    } catch (error) {
      removePlannedQuotes(route, plannedQuotes.slice(index + 1))
      if (index === 0) {
        throw error
      }
      throw new EcashPaymentError(
        {
          reason: 'mppPartialPayment',
          settled: index,
          total: plannedQuotes.length
        },
        { cause: error }
      )
    }
  }
}

/**
 * Pays a BOLT11 invoice from the account's ecash. Tries a single mint that
 * covers the amount plus fees first, then splits the payment across
 * MPP-capable mints. Throws `EcashPaymentError` when it cannot be routed.
 */
async function payLightningInvoiceFromMints(params: PayInvoiceParams) {
  const { amountSats } = params
  const startProofs = params.getProofs()
  const mintBalances = await getMintBalances(params, startProofs)
  const totalBalance = mintBalances.reduce((sum, mint) => sum + mint.balance, 0)
  if (totalBalance < amountSats) {
    throw new EcashPaymentError({ reason: 'insufficientProofs' })
  }

  const route: PaymentRoute = { ...params, mintBalances, quoteErrors: [] }
  const coveringUrls = coveringMintUrls(
    amountSats,
    mintBalances,
    params.selectedMintUrl
  )
  if (await payFromCoveringMint(route, coveringUrls, startProofs)) {
    return
  }

  const mppMints = mintBalances
    .filter((mint) => mint.supportsMpp && mint.balance > 0)
    .toSorted((a, b) => b.balance - a.balance)
  if (mppMints.length === 0) {
    const coveringQuoteError = route.quoteErrors.at(-1)
    if (coveringQuoteError) {
      rethrowQuoteError(coveringQuoteError)
    }
    throw new EcashPaymentError({
      reason: coveringUrls.length > 0 ? 'insufficientForFees' : 'mintsLackMpp'
    })
  }

  const plannedQuotes = await planMppQuotes(route, mppMints, amountSats, [])
  const plannedAmount = plannedQuotes.reduce(
    (sum, item) => sum + item.quote.amount,
    0
  )
  const isUnplanned = plannedQuotes.length === 0
  const lastQuoteError = route.quoteErrors.at(-1)
  if (isUnplanned && lastQuoteError) {
    rethrowQuoteError(lastQuoteError)
  }
  if (isUnplanned || plannedAmount < amountSats) {
    throw new EcashPaymentError({ reason: 'insufficientForFees' })
  }

  for (const item of plannedQuotes) {
    params.addMeltQuote(item.quote)
  }
  await meltPlannedQuotes(route, plannedQuotes)
}

export { EcashPaymentError, payLightningInvoiceFromMints }
