import {
  ARK_SWAP_BLOCK_INTERVAL_SECONDS,
  ARK_SWAP_BOARD_FEE_MAX_ROUNDS,
  ARK_SWAP_BOARD_WAIT_SAFETY_FACTOR,
  ARK_SWAP_INVOICE_MIN_REMAINING_SECONDS
} from '@/constants/ark'
import { DUST_LIMIT } from '@/constants/btc'
import {
  BOLT11_DEFAULT_EXPIRY_SECONDS,
  BOLT11_PAYMENT_HASH_HEX_PATTERN,
  LIGHTNING_CHANNEL_THRESHOLD
} from '@/constants/lightning'
import { type Account } from '@/types/models/Account'
import {
  type ArkAccount,
  type ArkLightningSendState,
  type ArkMovement,
  type ArkMovementEvent
} from '@/types/models/Ark'
import {
  type ArkOnchainToLightningJob,
  type ArkSwapEndpointKind,
  type ArkSwapJob,
  type ArkSwapRequest,
  type ArkSwapRoute
} from '@/types/models/ArkSwap'
import { type Network } from '@/types/settings/blockchain'
import { canAccountFundArkBoard } from '@/utils/arkBoardFunding'
import { getBolt11Network } from '@/utils/bolt11Network'
import {
  bolt11AmountSats,
  decodeLightningInvoice
} from '@/utils/lightningInvoiceDecoder'

const ARK_SWAP_ENDPOINT_KINDS: readonly ArkSwapEndpointKind[] = [
  'ark',
  'lightning',
  'onchain'
]

const ROUTE_BY_ENDPOINTS: Record<
  ArkSwapEndpointKind,
  Partial<Record<ArkSwapEndpointKind, ArkSwapRoute>>
> = {
  ark: { lightning: 'arkToLightning', onchain: 'arkToOnchain' },
  lightning: { ark: 'lightningToArk', onchain: 'lightningToOnchain' },
  onchain: { ark: 'onchainToArk', lightning: 'onchainToLightning' }
}

const LIGHTNING_URI_PREFIX = /^lightning:/i

const TERMINAL_STATUSES: ReadonlySet<ArkSwapJob['status']> = new Set([
  'completed',
  'failed'
])

// Statuses where nothing is in flight, so forgetting the job loses nothing.
const DISMISSIBLE_STATUSES: ReadonlySet<ArkSwapJob['status']> = new Set([
  ...TERMINAL_STATUSES,
  'awaitingFunding',
  'awaitingInvoice'
])

type ArkSwapInvoice = {
  invoice: string
  paymentHash: string
  amountSats: number
  expiresAt: number
}

type ArkSwapInvoiceRejection =
  | 'invalid'
  | 'wrongNetwork'
  | 'amountless'
  | 'expired'

type ArkSwapInvoiceResult =
  | { ok: true; invoice: ArkSwapInvoice }
  | { ok: false; reason: ArkSwapInvoiceRejection }

type DecodedSwapInvoiceFields = {
  invoice: string
  invoiceNetwork: Network | null
  paymentHash: string
  amountSats: number
  timestamp: number
  expirySeconds: number | undefined
}

type ArkSwapPayout =
  | { ok: true; amountSats: number; feeSats: number }
  | { ok: false; reason: 'belowDust' }

type ArkSwapAmountRangeInput = {
  fromKind: ArkSwapEndpointKind
  arkSpendableSats: number
  sourceBalanceSats: number
  minBoardSats: number
}

type ArkSwapAmountRange = {
  minSats: number
  maxSats: number
}

type ArkSwapForm = {
  arkAccountId: string
  fromKind: ArkSwapEndpointKind
  toKind: ArkSwapEndpointKind
  sourceAccountId: string | undefined
  destinationAccountId: string | undefined
  amountSats: number
  invoice: string
}

function resolveArkSwapRoute(
  fromKind: ArkSwapEndpointKind,
  toKind: ArkSwapEndpointKind
): ArkSwapRoute | undefined {
  return ROUTE_BY_ENDPOINTS[fromKind][toKind]
}

function getArkSwapDestinationKinds(
  fromKind: ArkSwapEndpointKind
): ArkSwapEndpointKind[] {
  return ARK_SWAP_ENDPOINT_KINDS.filter(
    (toKind) => resolveArkSwapRoute(fromKind, toKind) !== undefined
  )
}

/**
 * The legs a swap travels. Every route passes through the Ark balance, which
 * is only shown as a hop when it is not already an endpoint.
 */
function getArkSwapHops(
  fromKind: ArkSwapEndpointKind,
  toKind: ArkSwapEndpointKind
): ArkSwapEndpointKind[] {
  if (fromKind === 'ark' || toKind === 'ark') {
    return [fromKind, toKind]
  }
  return [fromKind, 'ark', toKind]
}

/**
 * Where a swap's amount comes from: an invoice to pay fixes it, otherwise the
 * user types it.
 */
function getArkSwapAmountSource(
  route: ArkSwapRoute,
  invoice: string
): 'input' | 'invoice' {
  if (route === 'arkToLightning') {
    return 'invoice'
  }
  if (route === 'onchainToLightning' && invoice.trim() !== '') {
    return 'invoice'
  }
  return 'input'
}

function getArkSwapMaxSats({
  fromKind,
  arkSpendableSats,
  sourceBalanceSats
}: Omit<ArkSwapAmountRangeInput, 'minBoardSats'>): number {
  if (fromKind === 'ark') {
    return arkSpendableSats
  }
  if (fromKind === 'onchain') {
    return sourceBalanceSats
  }
  return LIGHTNING_CHANNEL_THRESHOLD
}

/**
 * Smallest amount a swap can move: a board has the Ark server's minimum,
 * anything else the dust limit.
 */
function getArkSwapMinSats(
  fromKind: ArkSwapEndpointKind,
  minBoardSats: number
): number {
  return fromKind === 'onchain' ? minBoardSats : DUST_LIMIT
}

/**
 * The amounts a swap can move, or undefined when the balance it spends is
 * below the minimum.
 */
function getArkSwapAmountRange(
  input: ArkSwapAmountRangeInput
): ArkSwapAmountRange | undefined {
  const minSats = getArkSwapMinSats(input.fromKind, input.minBoardSats)
  const maxSats = getArkSwapMaxSats(input)
  return maxSats >= minSats ? { maxSats, minSats } : undefined
}

/**
 * The amount to request: what the user picked, capped by the current range,
 * so switching to a poorer wallet never requests more than it holds. Below
 * the minimum there is nothing to request.
 */
function clampArkSwapAmount(
  amountSats: number,
  range: ArkSwapAmountRange | undefined
): number {
  if (!range || amountSats < range.minSats) {
    return 0
  }
  return Math.min(amountSats, range.maxSats)
}

/**
 * Turns the swap form into a request, or undefined while a field the route
 * needs is still missing.
 */
function buildArkSwapRequest(form: ArkSwapForm): ArkSwapRequest | undefined {
  const route = resolveArkSwapRoute(form.fromKind, form.toKind)
  const { arkAccountId, amountSats, sourceAccountId, destinationAccountId } =
    form
  const invoice = form.invoice.trim()
  const hasAmount = amountSats > 0
  switch (route) {
    case 'arkToLightning': {
      return invoice ? { arkAccountId, invoice, route } : undefined
    }
    case 'arkToOnchain':
    case 'lightningToOnchain': {
      return destinationAccountId && hasAmount
        ? { amountSats, arkAccountId, destinationAccountId, route }
        : undefined
    }
    case 'lightningToArk': {
      return hasAmount ? { amountSats, arkAccountId, route } : undefined
    }
    case 'onchainToArk': {
      return sourceAccountId && hasAmount
        ? { amountSats, arkAccountId, route, sourceAccountId }
        : undefined
    }
    case 'onchainToLightning': {
      return sourceAccountId && (hasAmount || invoice)
        ? {
            amountSats,
            arkAccountId,
            invoice: invoice || undefined,
            route,
            sourceAccountId
          }
        : undefined
    }
    default: {
      return undefined
    }
  }
}

function isArkSwapJobTerminal(job: Pick<ArkSwapJob, 'status'>): boolean {
  return TERMINAL_STATUSES.has(job.status)
}

function isArkSwapJobRunnable(job: Pick<ArkSwapJob, 'status'>): boolean {
  return !isArkSwapJobTerminal(job) && job.status !== 'awaitingInvoice'
}

function canDismissArkSwapJob(job: Pick<ArkSwapJob, 'status'>): boolean {
  return DISMISSIBLE_STATUSES.has(job.status)
}

function canSubmitArkSwapInvoice(job: ArkSwapJob): boolean {
  return (
    job.kind === 'onchainToLightning' &&
    (job.status === 'awaitingInvoice' || job.status === 'failed')
  )
}

/**
 * The Ark account an on-chain wallet can swap through: the first one on the
 * same network, and only when the wallet can fund a board.
 */
function findArkSwapAccountForWallet(
  arkAccounts: Pick<ArkAccount, 'id' | 'network'>[],
  wallet: Pick<Account, 'keys' | 'network'>
): string | undefined {
  return arkAccounts.find((arkAccount) =>
    canAccountFundArkBoard(wallet, arkAccount.network)
  )?.id
}

function getArkSwapJobAccountId(job: ArkSwapJob): string {
  return job.kind === 'onchainToLightning'
    ? job.sourceAccountId
    : job.destinationAccountId
}

/**
 * Addresses of a wallet that swap payouts already took. They stay reserved
 * until the wallet's own transactions show them.
 */
function getArkSwapPayoutAddresses(
  jobs: ArkSwapJob[],
  destinationAccountId: string
): string[] {
  return jobs.flatMap((job) =>
    job.kind === 'lightningToOnchain' &&
    job.destinationAccountId === destinationAccountId &&
    job.destinationAddress
      ? [job.destinationAddress]
      : []
  )
}

/**
 * Board amount a swap waiting on this board address needs. A smaller board
 * cannot pay the swap's invoice.
 */
function getArkSwapRequiredBoardSats(
  jobs: ArkSwapJob[],
  boardAddress: string
): number | undefined {
  const job = jobs.find(
    (candidate) =>
      candidate.kind === 'onchainToLightning' &&
      candidate.status === 'awaitingFunding' &&
      candidate.boardAddress === boardAddress
  )
  return job?.amountSats
}

/**
 * Whether an Ark movement is the lightning payment of a swap that forwards it
 * on-chain, so it is not a receive the user keeps in Ark.
 */
function isArkSwapForwardedPayment(
  jobs: ArkSwapJob[],
  movement: Pick<ArkMovementEvent, 'accountId' | 'paymentHash'>
): boolean {
  const paymentHash = movement.paymentHash?.toLowerCase()
  if (!paymentHash) {
    return false
  }
  return jobs.some(
    (job) =>
      job.kind === 'lightningToOnchain' &&
      job.arkAccountId === movement.accountId &&
      job.paymentHash.toLowerCase() === paymentHash
  )
}

function evaluateArkSwapInvoice(
  fields: DecodedSwapInvoiceFields,
  network: Network,
  nowSeconds: number
): ArkSwapInvoiceResult {
  if (fields.invoiceNetwork !== network) {
    return { ok: false, reason: 'wrongNetwork' }
  }
  if (
    !BOLT11_PAYMENT_HASH_HEX_PATTERN.test(fields.paymentHash) ||
    !Number.isFinite(fields.timestamp)
  ) {
    return { ok: false, reason: 'invalid' }
  }
  if (fields.amountSats <= 0) {
    return { ok: false, reason: 'amountless' }
  }
  const expiresAt =
    fields.timestamp + (fields.expirySeconds ?? BOLT11_DEFAULT_EXPIRY_SECONDS)
  if (expiresAt <= nowSeconds) {
    return { ok: false, reason: 'expired' }
  }
  return {
    invoice: {
      amountSats: fields.amountSats,
      expiresAt,
      invoice: fields.invoice,
      paymentHash: fields.paymentHash
    },
    ok: true
  }
}

function parseNonNegativeNumber(value: string): number | undefined {
  const parsed = Number(value)
  return value !== '' && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : undefined
}

function decodeSwapInvoiceFields(
  invoice: string
): DecodedSwapInvoiceFields | undefined {
  try {
    const decoded = decodeLightningInvoice(invoice)
    return {
      amountSats: bolt11AmountSats(decoded),
      expirySeconds: parseNonNegativeNumber(decoded.expiry),
      invoice,
      invoiceNetwork: getBolt11Network(invoice),
      paymentHash: decoded.payment_hash,
      timestamp: Number(decoded.timestamp)
    }
  } catch {
    return undefined
  }
}

/**
 * Checks a BOLT 11 invoice can be paid from an Ark account on `network`:
 * same network, carries an amount and a payment hash, not yet expired.
 */
function parseArkSwapInvoice(
  rawInvoice: string,
  network: Network,
  nowSeconds: number
): ArkSwapInvoiceResult {
  const invoice = rawInvoice.trim().replace(LIGHTNING_URI_PREFIX, '')
  const fields = decodeSwapInvoiceFields(invoice)
  if (!fields) {
    return { ok: false, reason: 'invalid' }
  }
  return evaluateArkSwapInvoice(fields, network, nowSeconds)
}

function hasInvoiceTimeToPay(expiresAt: number, nowSeconds: number): boolean {
  return expiresAt - nowSeconds >= ARK_SWAP_INVOICE_MIN_REMAINING_SECONDS
}

/**
 * Whether an invoice supplied before boarding is likely to still be payable
 * once the board has the confirmations the Ark server requires.
 */
function willInvoiceOutlastBoard({
  expiresAt,
  nowSeconds,
  requiredConfirmations
}: {
  expiresAt: number
  nowSeconds: number
  requiredConfirmations: number
}): boolean {
  const boardWaitSeconds =
    requiredConfirmations *
    ARK_SWAP_BLOCK_INTERVAL_SECONDS *
    ARK_SWAP_BOARD_WAIT_SAFETY_FACTOR
  return hasInvoiceTimeToPay(expiresAt, nowSeconds + boardWaitSeconds)
}

function computeArkSwapPayout({
  receivedSats,
  feeSats
}: {
  receivedSats: number
  feeSats: number
}): ArkSwapPayout {
  const amountSats = receivedSats - feeSats
  if (amountSats < DUST_LIMIT) {
    return { ok: false, reason: 'belowDust' }
  }
  return { amountSats, feeSats, ok: true }
}

/**
 * What a board must bring into Ark to pay an invoice: the invoice, the Ark
 * server's lightning send fee and its board fee.
 */
function computeRequiredBoardSats({
  invoiceSats,
  lightningFeeSats,
  boardFeeSats
}: {
  invoiceSats: number
  lightningFeeSats: number
  boardFeeSats: number
}): number {
  return invoiceSats + lightningFeeSats + boardFeeSats
}

/**
 * Largest invoice a board pays after its own fee and the lightning fee. The
 * lightning fee is estimated at the board amount, an upper bound, so an
 * invoice of this size always passes the fit check.
 */
function computeMaxInvoiceSats({
  boardSats,
  boardFeeSats,
  lightningFeeSats
}: {
  boardSats: number
  boardFeeSats: number
  lightningFeeSats: number
}): number {
  return Math.max(0, boardSats - boardFeeSats - lightningFeeSats)
}

type RequiredBoardSearch = {
  invoiceSats: number
  lightningFeeSats: number
  minBoardSats: number
  estimateBoardFeeSats: (boardSats: number) => Promise<number>
}

async function searchRequiredBoardSats(
  search: RequiredBoardSearch,
  candidateSats: number,
  roundsLeft: number
): Promise<number | undefined> {
  if (roundsLeft <= 0) {
    return undefined
  }
  const boardFeeSats = await search.estimateBoardFeeSats(candidateSats)
  const requiredSats = computeRequiredBoardSats({
    boardFeeSats,
    invoiceSats: search.invoiceSats,
    lightningFeeSats: search.lightningFeeSats
  })
  if (requiredSats <= candidateSats) {
    return candidateSats
  }
  return searchRequiredBoardSats(search, requiredSats, roundsLeft - 1)
}

/**
 * Smallest board that covers an invoice, never below the server's minimum
 * board. The board fee grows with the board amount, so the amount is raised
 * until it also covers its own fee. Undefined when that does not settle
 * within the allowed rounds.
 */
function findRequiredBoardSats(
  search: RequiredBoardSearch
): Promise<number | undefined> {
  return searchRequiredBoardSats(
    search,
    Math.max(search.minBoardSats, search.invoiceSats + search.lightningFeeSats),
    ARK_SWAP_BOARD_FEE_MAX_ROUNDS
  )
}

/**
 * The status a boarded swap moves to: pay the invoice it already holds while
 * there is time left, otherwise wait for the user to provide one.
 */
function getBoardedSwapStatus(
  invoiceExpiresAt: number | undefined,
  nowSeconds: number
): Extract<ArkOnchainToLightningJob['status'], 'paying' | 'awaitingInvoice'> {
  if (
    invoiceExpiresAt === undefined ||
    !hasInvoiceTimeToPay(invoiceExpiresAt, nowSeconds)
  ) {
    return 'awaitingInvoice'
  }
  return 'paying'
}

/**
 * Maps the wallet's view of a started lightning send onto the job. An
 * unknown send never went out or was revoked, so it is reported as failed and
 * is never paid again without the user asking.
 */
function getLightningSendOutcome(
  state: ArkLightningSendState
):
  | { status: 'completed'; preimage: string }
  | { status: 'failed' }
  | undefined {
  if (state.status === 'paid') {
    return { preimage: state.preimage, status: 'completed' }
  }
  if (state.status === 'unknown') {
    return { status: 'failed' }
  }
  return undefined
}

/**
 * What the Ark movements paying a payout's destination say about the send.
 * Only a successful movement completes it: a pending one can still fail and
 * return the sats to Ark.
 */
function getArkSwapPayoutOutcome(
  movements: Pick<ArkMovement, 'sentToAddresses' | 'status'>[],
  destinationAddress: string | undefined
): 'completed' | 'pending' | 'failed' | 'notFound' {
  if (destinationAddress === undefined) {
    return 'notFound'
  }
  const statuses = movements
    .filter((movement) => movement.sentToAddresses.includes(destinationAddress))
    .map((movement) => movement.status)
  if (statuses.includes('successful')) {
    return 'completed'
  }
  if (statuses.some((status) => status !== 'failed' && status !== 'canceled')) {
    return 'pending'
  }
  return statuses.length > 0 ? 'failed' : 'notFound'
}

export {
  type ArkSwapAmountRange,
  type ArkSwapForm,
  type ArkSwapInvoice,
  type ArkSwapInvoiceRejection,
  type ArkSwapPayout,
  buildArkSwapRequest,
  canDismissArkSwapJob,
  canSubmitArkSwapInvoice,
  clampArkSwapAmount,
  computeArkSwapPayout,
  computeMaxInvoiceSats,
  computeRequiredBoardSats,
  evaluateArkSwapInvoice,
  findArkSwapAccountForWallet,
  findRequiredBoardSats,
  getArkSwapAmountRange,
  getArkSwapAmountSource,
  getArkSwapDestinationKinds,
  getArkSwapHops,
  getArkSwapJobAccountId,
  getArkSwapMinSats,
  getArkSwapPayoutAddresses,
  getArkSwapPayoutOutcome,
  getArkSwapRequiredBoardSats,
  getBoardedSwapStatus,
  getLightningSendOutcome,
  hasInvoiceTimeToPay,
  isArkSwapForwardedPayment,
  isArkSwapJobRunnable,
  isArkSwapJobTerminal,
  parseArkSwapInvoice,
  resolveArkSwapRoute,
  willInvoiceOutlastBoard
}
