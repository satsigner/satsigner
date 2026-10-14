import {
  createMppMeltQuote,
  getMintBalance,
  mintSupportsBolt11Mpp
} from '@/api/ecash'
import type {
  EcashMint,
  EcashProof,
  MeltQuote,
  WalletOptions
} from '@/types/models/Ecash'
import {
  coveringMintUrls,
  mintCoversMeltQuote,
  sliceAmountAfterFeeMiss
} from '@/utils/ecashMintRoute'

const MAX_MPP_FEE_SLICE_ATTEMPTS = 3

type EcashPaymentFailure =
  | 'insufficientProofs'
  | 'insufficientForFees'
  | 'mintsLackMpp'
  | 'mppPartialPayment'

/** A Lightning payment from ecash could not be routed or fully settled. */
class EcashPaymentError extends Error {
  readonly reason: EcashPaymentFailure
  readonly settled: number
  readonly total: number

  constructor(
    reason: EcashPaymentFailure,
    options?: ErrorOptions & { settled?: number; total?: number }
  ) {
    super(reason, options)
    this.name = 'EcashPaymentError'
    this.reason = reason
    this.settled = options?.settled ?? 0
    this.total = options?.total ?? 0
  }
}

type MintBalance = {
  balance: number
  mintUrl: string
  supportsMpp: boolean
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
  /** Creates a melt quote and records it for the account. */
  createMeltQuote: (mintUrl: string, invoice: string) => Promise<MeltQuote>
  /** Melts proofs against a quote and updates the stored proofs. */
  meltProofs: (
    mintUrl: string,
    quote: MeltQuote,
    proofs: EcashProof[]
  ) => Promise<unknown>
  addMeltQuote: (quote: MeltQuote) => void
  removeMeltQuote: (quoteId: string) => void
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error))
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

function getMintBalances(
  { accountId, mints, options }: PayInvoiceParams,
  proofs: EcashProof[]
): Promise<MintBalance[]> {
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

/**
 * Pays a BOLT11 invoice from the account's ecash. Tries a single mint that
 * covers the amount plus fees first, then splits the payment across
 * MPP-capable mints. Throws `EcashPaymentError` when it cannot be routed.
 */
async function payLightningInvoiceFromMints(params: PayInvoiceParams) {
  const { accountId, invoice, amountSats, options } = params
  const startProofs = params.getProofs()
  const mintBalances = await getMintBalances(params, startProofs)
  const totalBalance = mintBalances.reduce((sum, mint) => sum + mint.balance, 0)
  if (totalBalance < amountSats) {
    throw new EcashPaymentError('insufficientProofs')
  }

  const coveringUrls = coveringMintUrls(
    amountSats,
    mintBalances,
    params.selectedMintUrl
  )
  let lastQuoteCreationError: Error | undefined

  async function payWithCoveringMint(index: number): Promise<boolean> {
    const mintUrl = coveringUrls[index]
    if (!mintUrl) {
      return false
    }
    const quoteResult = await settleQuote(
      params.createMeltQuote(mintUrl, invoice)
    )
    if (!quoteResult.ok) {
      lastQuoteCreationError = quoteResult.error
      return payWithCoveringMint(index + 1)
    }
    const { quote } = quoteResult
    const balance =
      mintBalances.find((mint) => mint.mintUrl === mintUrl)?.balance ?? 0
    if (!mintCoversMeltQuote(balance, quote)) {
      params.removeMeltQuote(quote.quote)
      return payWithCoveringMint(index + 1)
    }
    const mintProofs = startProofs.filter((proof) => proof.mintUrl === mintUrl)
    await params.meltProofs(mintUrl, quote, mintProofs)
    return true
  }

  if (await payWithCoveringMint(0)) {
    return
  }

  const mppMints = mintBalances
    .filter((mint) => mint.supportsMpp && mint.balance > 0)
    .toSorted((a, b) => b.balance - a.balance)

  if (mppMints.length === 0) {
    if (lastQuoteCreationError) {
      rethrowQuoteError(lastQuoteCreationError)
    }
    throw new EcashPaymentError(
      coveringUrls.length > 0 ? 'insufficientForFees' : 'mintsLackMpp'
    )
  }

  async function quoteCoveredSlice(
    mint: MintBalance,
    remainingSats: number,
    take: number,
    attemptsLeft: number
  ): Promise<MeltQuote | null> {
    if (take <= 0 || attemptsLeft <= 0) {
      return null
    }
    const quoteResult = await settleQuote(
      createMppMeltQuote(accountId, mint.mintUrl, invoice, take, options)
    )
    if (!quoteResult.ok) {
      lastQuoteCreationError = quoteResult.error
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
    return quoteCoveredSlice(mint, remainingSats, nextTake, attemptsLeft - 1)
  }

  async function planMppQuotes(
    mintsLeft: MintBalance[],
    remainingSats: number,
    planned: PlannedQuote[]
  ): Promise<PlannedQuote[]> {
    if (remainingSats <= 0) {
      return planned
    }
    const [mint, ...rest] = mintsLeft
    if (!mint) {
      return planned
    }
    const quote = await quoteCoveredSlice(
      mint,
      remainingSats,
      Math.min(mint.balance, remainingSats),
      MAX_MPP_FEE_SLICE_ATTEMPTS
    )
    if (!quote) {
      return planMppQuotes(rest, remainingSats, planned)
    }
    return planMppQuotes(rest, remainingSats - quote.amount, [
      ...planned,
      { mintUrl: mint.mintUrl, quote }
    ])
  }

  const plannedQuotes = await planMppQuotes(mppMints, amountSats, [])
  const plannedAmount = plannedQuotes.reduce(
    (sum, item) => sum + item.quote.amount,
    0
  )
  if (plannedQuotes.length === 0 || plannedAmount < amountSats) {
    if (plannedQuotes.length === 0 && lastQuoteCreationError) {
      rethrowQuoteError(lastQuoteCreationError)
    }
    throw new EcashPaymentError('insufficientForFees')
  }

  for (const item of plannedQuotes) {
    params.addMeltQuote(item.quote)
  }

  async function meltPlannedQuotes(index: number): Promise<void> {
    const item = plannedQuotes[index]
    if (!item) {
      return
    }
    try {
      const mintProofs = params
        .getProofs()
        .filter((proof) => proof.mintUrl === item.mintUrl)
      await params.meltProofs(item.mintUrl, item.quote, mintProofs)
      await meltPlannedQuotes(index + 1)
    } catch (error) {
      for (const unused of plannedQuotes.slice(index + 1)) {
        params.removeMeltQuote(unused.quote.quote)
      }
      if (index > 0) {
        throw new EcashPaymentError('mppPartialPayment', {
          cause: error,
          settled: index,
          total: plannedQuotes.length
        })
      }
      throw error
    }
  }

  await meltPlannedQuotes(0)
}

export { EcashPaymentError, payLightningInvoiceFromMints }
