import {
  checkArkLightningSend,
  claimArkLightningReceive,
  createArkBolt11Invoice,
  estimateArkBoardFee,
  estimateArkLightningReceiveFee,
  estimateArkLightningSendFee,
  estimateArkSendOnchainFee,
  fetchArkBalance,
  fetchArkLightningReceive,
  fetchArkMovements,
  fetchArkServerInfo,
  listArkPendingBoards,
  payArkBolt11,
  sendArkOnchain,
  syncArkWallet
} from '@/api/ark'
import {
  ARK_LIGHTNING_RECEIVE_AWAITING_STATE,
  ARK_PENDING_TXID
} from '@/constants/ark'
import { DUST_LIMIT } from '@/constants/btc'
import { t } from '@/locales'
import {
  peekFreshReceiveAddress,
  reserveFreshReceiveAddress
} from '@/services/accountReceiveAddress'
import { prepareArkBoardFromAccount } from '@/services/arkBoardFunding'
import { ensureArkWalletOpen } from '@/services/arkWallet'
import { useAccountsStore } from '@/store/accounts'
import { getArkAccountOrThrow, useArkStore } from '@/store/ark'
import { getArkSwapJob, useArkSwapsStore } from '@/store/arkSwaps'
import { type Account } from '@/types/models/Account'
import { type ArkAccount } from '@/types/models/Ark'
import {
  type ArkLightningToOnchainJob,
  type ArkOnchainToLightningJob,
  type ArkSwapJob,
  type ArkSwapQuote,
  type ArkSwapRequest,
  type ArkSwapStartResult
} from '@/types/models/ArkSwap'
import { getArkMinBoardAmount } from '@/utils/arkBoard'
import { canAccountFundArkBoard } from '@/utils/arkBoardFunding'
import { canAccountReceiveArkSweep } from '@/utils/arkOnchainSweep'
import {
  type ArkSwapInvoice,
  type ArkSwapJobFailures,
  canSubmitArkSwapInvoice,
  computeArkSwapPayout,
  computeMaxInvoiceSats,
  computeRequiredBoardSats,
  findRequiredBoardSats,
  getArkSwapPayoutAddresses,
  getArkSwapPayoutOutcome,
  getBoardedSwapStatus,
  getLightningSendOutcome,
  hasInvoiceTimeToPay,
  isArkSwapJobRetryDue,
  isArkSwapJobRunnable,
  isArkSwapSendReconcileDue,
  parseArkSwapInvoice,
  willInvoiceOutlastBoard
} from '@/utils/arkSwap'

const MS_PER_SECOND = 1000

// Jobs advanced right now in this JS context. Persisted statuses guard
// against repeats across restarts; this guards against overlapping ticks.
const runningJobIds = new Set<string>()

// Consecutive failures per job in this JS context, for retry backoff. A
// restart retries every job straight away.
const jobFailures = new Map<string, ArkSwapJobFailures>()

function nowSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function createJobId(): string {
  return `swap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function saveJob(job: ArkSwapJob) {
  useArkSwapsStore.getState().saveJob({ ...job, updatedAt: Date.now() })
}

function findAccount(accountId: string): Account | undefined {
  return useAccountsStore
    .getState()
    .accounts.find((account) => account.id === accountId)
}

function requireDestination(
  accountId: string,
  arkAccount: ArkAccount
): Account {
  const account = findAccount(accountId)
  if (!account || !canAccountReceiveArkSweep(account, arkAccount.network)) {
    throw new Error(t('ark.swap.error.destinationIneligible'))
  }
  return account
}

function requireSource(accountId: string, arkAccount: ArkAccount): Account {
  const account = findAccount(accountId)
  if (!account || !canAccountFundArkBoard(account, arkAccount.network)) {
    throw new Error(t('ark.board.fromWallet.error.ineligible'))
  }
  return account
}

function requirePayableInvoice(
  rawInvoice: string,
  arkAccount: ArkAccount
): ArkSwapInvoice {
  const parsed = parseArkSwapInvoice(
    rawInvoice,
    arkAccount.network,
    nowSeconds()
  )
  if (!parsed.ok) {
    throw new Error(t(`ark.swap.error.invoice.${parsed.reason}`))
  }
  if (!hasInvoiceTimeToPay(parsed.invoice.expiresAt, nowSeconds())) {
    throw new Error(t('ark.swap.error.invoice.expired'))
  }
  return parsed.invoice
}

async function payFromArk(arkAccountId: string, rawInvoice: string) {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  const invoice = requirePayableInvoice(rawInvoice, arkAccount)
  await ensureArkWalletOpen(arkAccountId)
  await payArkBolt11(arkAccount.serverId, arkAccountId, invoice.invoice)
  return { amountSats: invoice.amountSats, route: 'arkToLightning' as const }
}

async function sendArkToAccount(
  arkAccountId: string,
  destinationAccountId: string,
  amountSats: number
) {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  const destination = requireDestination(destinationAccountId, arkAccount)
  const [address] = await Promise.all([
    reserveFreshReceiveAddress(destination),
    ensureArkWalletOpen(arkAccountId)
  ])
  await sendArkOnchain(arkAccount.serverId, arkAccountId, address, amountSats)
  return {
    amountSats,
    destinationName: destination.name,
    route: 'arkToOnchain' as const
  }
}

async function receiveIntoArk(arkAccountId: string, amountSats: number) {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  await ensureArkWalletOpen(arkAccountId)
  const { invoice } = await createArkBolt11Invoice(
    arkAccount.serverId,
    arkAccountId,
    amountSats
  )
  return { amountSats, invoice, route: 'lightningToArk' as const }
}

async function startLightningToOnchain(
  arkAccountId: string,
  destinationAccountId: string,
  amountSats: number
) {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  requireDestination(destinationAccountId, arkAccount)
  await ensureArkWalletOpen(arkAccountId)
  const { invoice, paymentHash } = await createArkBolt11Invoice(
    arkAccount.serverId,
    arkAccountId,
    amountSats
  )
  const parsed = parseArkSwapInvoice(invoice, arkAccount.network, nowSeconds())
  if (!parsed.ok) {
    throw new Error(t(`ark.swap.error.invoice.${parsed.reason}`))
  }
  const now = Date.now()
  const job: ArkLightningToOnchainJob = {
    amountSats,
    arkAccountId,
    createdAt: now,
    destinationAccountId,
    id: createJobId(),
    invoice,
    invoiceExpiresAt: parsed.invoice.expiresAt,
    kind: 'lightningToOnchain',
    paymentHash,
    status: 'awaitingPayment',
    updatedAt: now
  }
  useArkSwapsStore.getState().saveJob(job)
  return { jobId: job.id, route: 'lightningToOnchain' as const }
}

async function startOnchainToArk(
  arkAccountId: string,
  sourceAccountId: string,
  amountSats: number
) {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  const fundingAccount = requireSource(sourceAccountId, arkAccount)
  await prepareArkBoardFromAccount({ amountSats, arkAccountId, fundingAccount })
  return { route: 'onchainToArk' as const, sourceAccountId }
}

async function assertInvoiceFitsBoard(
  arkAccount: ArkAccount,
  invoiceSats: number,
  boardSats: number
) {
  const [lightningFee, boardFee] = await Promise.all([
    estimateArkLightningSendFee(
      arkAccount.serverId,
      arkAccount.id,
      invoiceSats
    ),
    estimateArkBoardFee(arkAccount.serverId, arkAccount.id, boardSats)
  ])
  const requiredSats = computeRequiredBoardSats({
    boardFeeSats: boardFee.feeSats,
    invoiceSats,
    lightningFeeSats: lightningFee.feeSats
  })
  if (requiredSats > boardSats) {
    throw new Error(t('ark.swap.error.boardTooSmall'))
  }
}

async function assertArkCoversSend(arkAccount: ArkAccount, sendSats: number) {
  const balance = await fetchArkBalance(arkAccount.serverId, arkAccount.id)
  if (sendSats > balance.spendableSats) {
    throw new Error(t('ark.send.error.insufficientBalanceWithFee'))
  }
}

/** Largest invoice a boarded swap can still pay, for the invoice prompt. */
export async function estimateArkSwapMaxInvoiceSats(
  arkAccountId: string,
  boardSats: number
): Promise<number> {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  await ensureArkWalletOpen(arkAccountId)
  const [lightningFee, boardFee] = await Promise.all([
    estimateArkLightningSendFee(arkAccount.serverId, arkAccountId, boardSats),
    estimateArkBoardFee(arkAccount.serverId, arkAccountId, boardSats)
  ])
  return computeMaxInvoiceSats({
    boardFeeSats: boardFee.feeSats,
    boardSats,
    lightningFeeSats: lightningFee.feeSats
  })
}

async function computeBoardForInvoice(
  arkAccount: ArkAccount,
  invoiceSats: number
): Promise<number> {
  const [lightningFee, serverInfo] = await Promise.all([
    estimateArkLightningSendFee(
      arkAccount.serverId,
      arkAccount.id,
      invoiceSats
    ),
    fetchArkServerInfo(arkAccount.serverId, arkAccount.id)
  ])
  async function estimateBoardFeeSats(boardSats: number) {
    const boardFee = await estimateArkBoardFee(
      arkAccount.serverId,
      arkAccount.id,
      boardSats
    )
    return boardFee.feeSats
  }
  const boardSats = await findRequiredBoardSats({
    estimateBoardFeeSats,
    invoiceSats,
    lightningFeeSats: lightningFee.feeSats,
    minBoardSats:
      getArkMinBoardAmount(serverInfo?.minBoardAmountSats) ?? DUST_LIMIT
  })
  if (boardSats === undefined) {
    throw new Error(t('ark.swap.error.boardFeeUnsettled'))
  }
  return boardSats
}

async function canHoldInvoiceForBoard(
  arkAccount: ArkAccount,
  invoice: ArkSwapInvoice
): Promise<boolean> {
  const serverInfo = await fetchArkServerInfo(
    arkAccount.serverId,
    arkAccount.id
  )
  return willInvoiceOutlastBoard({
    expiresAt: invoice.expiresAt,
    nowSeconds: nowSeconds(),
    requiredConfirmations: serverInfo?.requiredBoardConfirmations ?? 0
  })
}

/**
 * With an invoice up front the board is sized to cover it and every Ark fee
 * on the way, whatever amount was typed.
 */
async function startOnchainToLightning(
  arkAccountId: string,
  sourceAccountId: string,
  amountSats: number,
  rawInvoice: string | undefined
) {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  const fundingAccount = requireSource(sourceAccountId, arkAccount)
  await ensureArkWalletOpen(arkAccountId)
  const invoice = rawInvoice?.trim()
    ? requirePayableInvoice(rawInvoice, arkAccount)
    : undefined
  const [boardSats, invoiceHeld] = invoice
    ? await Promise.all([
        computeBoardForInvoice(arkAccount, invoice.amountSats),
        canHoldInvoiceForBoard(arkAccount, invoice)
      ])
    : [amountSats, false]

  const intent = await prepareArkBoardFromAccount({
    amountSats: boardSats,
    arkAccountId,
    fundingAccount
  })
  const now = Date.now()
  const heldInvoice = invoiceHeld ? invoice : undefined
  const job: ArkOnchainToLightningJob = {
    amountSats: boardSats,
    arkAccountId,
    boardAddress: intent.address,
    createdAt: now,
    id: createJobId(),
    invoice: heldInvoice?.invoice,
    invoiceExpiresAt: heldInvoice?.expiresAt,
    kind: 'onchainToLightning',
    paymentHash: heldInvoice?.paymentHash,
    sourceAccountId,
    status: 'awaitingFunding',
    updatedAt: now
  }
  useArkSwapsStore.getState().saveJob(job)
  return {
    invoiceHeld,
    jobId: job.id,
    route: 'onchainToLightning' as const,
    sourceAccountId
  }
}

/**
 * Starts a swap. Ark, lightning-to-Ark and Ark-to-on-chain routes finish
 * here; routes that board or wait for a payment leave a persisted job for
 * `advanceArkSwapJobs` to drive.
 */
export function startArkSwap(
  input: ArkSwapRequest
): Promise<ArkSwapStartResult> {
  switch (input.route) {
    case 'arkToLightning': {
      return payFromArk(input.arkAccountId, input.invoice)
    }
    case 'arkToOnchain': {
      return sendArkToAccount(
        input.arkAccountId,
        input.destinationAccountId,
        input.amountSats
      )
    }
    case 'lightningToArk': {
      return receiveIntoArk(input.arkAccountId, input.amountSats)
    }
    case 'lightningToOnchain': {
      return startLightningToOnchain(
        input.arkAccountId,
        input.destinationAccountId,
        input.amountSats
      )
    }
    case 'onchainToArk': {
      return startOnchainToArk(
        input.arkAccountId,
        input.sourceAccountId,
        input.amountSats
      )
    }
    case 'onchainToLightning': {
      return startOnchainToLightning(
        input.arkAccountId,
        input.sourceAccountId,
        input.amountSats,
        input.invoice
      )
    }
    default: {
      const _exhaustive: never = input
      throw new Error(`Unsupported swap: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

async function quoteOnchainToLightning(
  arkAccount: ArkAccount,
  amountSats: number,
  rawInvoice: string | undefined
): Promise<ArkSwapQuote> {
  const invoice = rawInvoice?.trim()
    ? requirePayableInvoice(rawInvoice, arkAccount)
    : undefined
  if (!invoice) {
    const boardFee = await estimateArkBoardFee(
      arkAccount.serverId,
      arkAccount.id,
      amountSats
    )
    const lightningFee = await estimateArkLightningSendFee(
      arkAccount.serverId,
      arkAccount.id,
      boardFee.netAmountSats
    )
    const feeSats = boardFee.feeSats + lightningFee.feeSats
    return { feeSats, receiveSats: amountSats - feeSats, sendSats: amountSats }
  }
  const sendSats = await computeBoardForInvoice(arkAccount, invoice.amountSats)
  return {
    feeSats: sendSats - invoice.amountSats,
    receiveSats: invoice.amountSats,
    sendSats
  }
}

async function estimateLightningReceiveFeeSats(
  arkAccount: ArkAccount,
  amountSats: number
): Promise<number> {
  const estimate = await estimateArkLightningReceiveFee(
    arkAccount.serverId,
    arkAccount.id,
    amountSats
  )
  return estimate.feeSats
}

async function quoteToAccount(
  arkAccount: ArkAccount,
  destinationAccountId: string,
  amountSats: number,
  viaLightning: boolean
): Promise<ArkSwapQuote> {
  const destination = requireDestination(destinationAccountId, arkAccount)
  const address = await peekFreshReceiveAddress(destination)
  const receiveFee = viaLightning
    ? await estimateLightningReceiveFeeSats(arkAccount, amountSats)
    : 0
  const inArkSats = amountSats - receiveFee
  const sendFee = await estimateArkSendOnchainFee(
    arkAccount.serverId,
    arkAccount.id,
    address,
    inArkSats
  )
  if (!viaLightning) {
    const sendSats = amountSats + sendFee.feeSats
    await assertArkCoversSend(arkAccount, sendSats)
    return { feeSats: sendFee.feeSats, receiveSats: amountSats, sendSats }
  }
  const feeSats = receiveFee + sendFee.feeSats
  return { feeSats, receiveSats: amountSats - feeSats, sendSats: amountSats }
}

async function quoteIntoArk(
  arkAccount: ArkAccount,
  amountSats: number,
  viaLightning: boolean
): Promise<ArkSwapQuote> {
  const estimate = viaLightning
    ? await estimateArkLightningReceiveFee(
        arkAccount.serverId,
        arkAccount.id,
        amountSats
      )
    : await estimateArkBoardFee(arkAccount.serverId, arkAccount.id, amountSats)
  return {
    feeSats: estimate.feeSats,
    receiveSats: amountSats - estimate.feeSats,
    sendSats: amountSats
  }
}

async function quoteArkToLightning(
  arkAccount: ArkAccount,
  rawInvoice: string
): Promise<ArkSwapQuote> {
  const invoice = requirePayableInvoice(rawInvoice, arkAccount)
  const estimate = await estimateArkLightningSendFee(
    arkAccount.serverId,
    arkAccount.id,
    invoice.amountSats
  )
  const sendSats = invoice.amountSats + estimate.feeSats
  await assertArkCoversSend(arkAccount, sendSats)
  return {
    feeSats: estimate.feeSats,
    receiveSats: invoice.amountSats,
    sendSats
  }
}

/**
 * Ark server fees for a swap. Boards also pay an on-chain miner fee, which
 * the transaction builder shows once the funding transaction is drafted.
 */
export async function quoteArkSwap(
  input: ArkSwapRequest
): Promise<ArkSwapQuote> {
  const arkAccount = getArkAccountOrThrow(input.arkAccountId)
  await ensureArkWalletOpen(input.arkAccountId)
  switch (input.route) {
    case 'arkToLightning': {
      return quoteArkToLightning(arkAccount, input.invoice)
    }
    case 'arkToOnchain':
    case 'lightningToOnchain': {
      return quoteToAccount(
        arkAccount,
        input.destinationAccountId,
        input.amountSats,
        input.route === 'lightningToOnchain'
      )
    }
    case 'lightningToArk':
    case 'onchainToArk': {
      return quoteIntoArk(
        arkAccount,
        input.amountSats,
        input.route === 'lightningToArk'
      )
    }
    case 'onchainToLightning': {
      return quoteOnchainToLightning(
        arkAccount,
        input.amountSats,
        input.invoice
      )
    }
    default: {
      const _exhaustive: never = input
      throw new Error(`Unsupported swap: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/**
 * Starts paying a boarded swap's invoice. `paying` is persisted before the
 * payment so a crash mid-payment is resolved by checking the send, never by
 * paying again.
 */
async function payJobInvoice(job: ArkOnchainToLightningJob) {
  const { invoice, paymentHash } = job
  if (!invoice || !paymentHash) {
    saveJob({ ...job, status: 'awaitingInvoice' })
    return
  }
  const paying: ArkOnchainToLightningJob = {
    ...job,
    error: undefined,
    status: 'paying'
  }
  saveJob(paying)
  const arkAccount = getArkAccountOrThrow(job.arkAccountId)
  try {
    const result = await payArkBolt11(
      arkAccount.serverId,
      job.arkAccountId,
      invoice
    )
    if (result.preimage) {
      saveJob({ ...paying, preimage: result.preimage, status: 'completed' })
    }
  } catch (error) {
    saveJob({ ...paying, error: errorMessage(error) })
  }
}

async function advanceBoardingJob(job: ArkOnchainToLightningJob) {
  const cosigned =
    useArkStore.getState().boardIntents[job.boardAddress]?.cosigned
  if (!cosigned) {
    return
  }
  const arkAccount = getArkAccountOrThrow(job.arkAccountId)
  await syncArkWallet(arkAccount.serverId, job.arkAccountId)
  const pendingBoards = await listArkPendingBoards(
    arkAccount.serverId,
    job.arkAccountId
  )
  if (pendingBoards.some((board) => board.txid === cosigned.txid)) {
    return
  }
  const nextStatus = getBoardedSwapStatus(job.invoiceExpiresAt, nowSeconds())
  if (nextStatus === 'paying') {
    await payJobInvoice(job)
    return
  }
  saveJob({
    ...job,
    error: job.invoice ? t('ark.swap.error.invoice.expired') : undefined,
    invoice: undefined,
    invoiceExpiresAt: undefined,
    paymentHash: undefined,
    status: 'awaitingInvoice'
  })
}

async function advancePayingJob(job: ArkOnchainToLightningJob) {
  if (!job.paymentHash) {
    saveJob({ ...job, status: 'awaitingInvoice' })
    return
  }
  const arkAccount = getArkAccountOrThrow(job.arkAccountId)
  const state = await checkArkLightningSend(
    arkAccount.serverId,
    job.arkAccountId,
    job.paymentHash
  )
  const outcome = getLightningSendOutcome(state)
  if (!outcome) {
    return
  }
  if (outcome.status === 'completed') {
    saveJob({ ...job, error: undefined, ...outcome })
    return
  }
  saveJob({
    ...job,
    error: job.error ?? t('ark.swap.error.paymentFailed'),
    status: 'failed'
  })
}

function advanceOnchainToLightning(job: ArkOnchainToLightningJob) {
  switch (job.status) {
    case 'awaitingFunding': {
      const intent = useArkStore.getState().boardIntents[job.boardAddress]
      if (intent?.cosigned) {
        saveJob({ ...job, status: 'boarding' })
      }
      return Promise.resolve()
    }
    case 'boarding': {
      return advanceBoardingJob(job)
    }
    case 'paying': {
      return advancePayingJob(job)
    }
    default: {
      return Promise.resolve()
    }
  }
}

async function sendLightningPayout(
  job: ArkLightningToOnchainJob,
  receivedSats: number
) {
  const arkAccount = getArkAccountOrThrow(job.arkAccountId)
  const destination = findAccount(job.destinationAccountId)
  if (!destination) {
    saveJob({
      ...job,
      error: t('ark.swap.error.destinationIneligible'),
      receivedSats,
      status: 'failed'
    })
    return
  }
  const address = await reserveFreshReceiveAddress(
    destination,
    getArkSwapPayoutAddresses(
      useArkSwapsStore.getState().jobs,
      job.destinationAccountId
    )
  )
  const receiveFee = await estimateArkLightningReceiveFee(
    arkAccount.serverId,
    job.arkAccountId,
    receivedSats
  )
  const inArkSats = receivedSats - receiveFee.feeSats
  const sendFee = await estimateArkSendOnchainFee(
    arkAccount.serverId,
    job.arkAccountId,
    address,
    inArkSats
  )
  const payout = computeArkSwapPayout({
    feeSats: sendFee.feeSats,
    receivedSats: inArkSats
  })
  if (!payout.ok) {
    saveJob({
      ...job,
      error: t('ark.swap.error.payoutBelowDust'),
      receivedSats,
      status: 'failed'
    })
    return
  }
  const sending: ArkLightningToOnchainJob = {
    ...job,
    destinationAddress: address,
    error: undefined,
    feeSats: receiveFee.feeSats + payout.feeSats,
    payoutSats: payout.amountSats,
    receivedSats,
    sendAttemptedAt: Date.now(),
    status: 'sending'
  }
  saveJob(sending)
  try {
    const txid = await sendArkOnchain(
      arkAccount.serverId,
      job.arkAccountId,
      address,
      payout.amountSats
    )
    if (txid === ARK_PENDING_TXID) {
      return
    }
    saveJob({ ...sending, status: 'completed', txid })
  } catch (error) {
    saveJob({
      ...sending,
      error: errorMessage(error),
      sendAttemptedAt: Date.now()
    })
  }
}

async function advanceAwaitingPayment(job: ArkLightningToOnchainJob) {
  const arkAccount = getArkAccountOrThrow(job.arkAccountId)
  const receive = await fetchArkLightningReceive(
    arkAccount.serverId,
    job.arkAccountId,
    job.paymentHash
  )
  if (receive.state === ARK_LIGHTNING_RECEIVE_AWAITING_STATE) {
    if (nowSeconds() >= job.invoiceExpiresAt) {
      saveJob({
        ...job,
        error: t('ark.swap.error.invoiceUnpaid'),
        status: 'failed'
      })
    }
    return
  }
  const claimed = receive.settled
    ? receive
    : await claimArkLightningReceive(
        arkAccount.serverId,
        job.arkAccountId,
        job.paymentHash
      )
  if (!claimed.settled) {
    return
  }
  await sendLightningPayout(job, claimed.amountSats ?? job.amountSats)
}

/**
 * A send that is still pending, threw, or was cut off by a restart may still
 * go out. Its movement decides once the grace period has passed: successful
 * means sent, pending keeps waiting, failed or none means the funds stayed in
 * Ark. It is never sent again automatically.
 */
async function reconcileSendingJob(job: ArkLightningToOnchainJob) {
  if (!isArkSwapSendReconcileDue(job, Date.now())) {
    return
  }
  const arkAccount = getArkAccountOrThrow(job.arkAccountId)
  const movements = await fetchArkMovements(
    arkAccount.serverId,
    job.arkAccountId
  )
  const outcome = getArkSwapPayoutOutcome(movements, job.destinationAddress)
  if (outcome === 'pending') {
    return
  }
  if (outcome === 'completed') {
    saveJob({ ...job, error: undefined, status: 'completed' })
    return
  }
  if (outcome === 'failed') {
    saveJob({ ...job, error: t('ark.swap.error.sendFailed'), status: 'failed' })
    return
  }
  saveJob({
    ...job,
    error: job.error ?? t('ark.swap.error.sendInterrupted'),
    status: 'failed'
  })
}

function advanceLightningToOnchain(job: ArkLightningToOnchainJob) {
  switch (job.status) {
    case 'awaitingPayment': {
      return advanceAwaitingPayment(job)
    }
    case 'sending': {
      return reconcileSendingJob(job)
    }
    default: {
      return Promise.resolve()
    }
  }
}

async function withJobLock(
  jobId: string,
  run: () => Promise<void>
): Promise<boolean> {
  if (runningJobIds.has(jobId)) {
    return false
  }
  runningJobIds.add(jobId)
  try {
    await run()
  } finally {
    runningJobIds.delete(jobId)
  }
  return true
}

async function advanceJob(jobId: string) {
  const job = getArkSwapJob(jobId)
  if (!job || !isArkSwapJobRunnable(job)) {
    return
  }
  try {
    await (job.kind === 'onchainToLightning'
      ? advanceOnchainToLightning(job)
      : advanceLightningToOnchain(job))
    jobFailures.delete(jobId)
  } catch (error) {
    jobFailures.set(jobId, {
      count: (jobFailures.get(jobId)?.count ?? 0) + 1,
      lastFailedAt: Date.now()
    })
    const latest = getArkSwapJob(jobId)
    if (latest) {
      saveJob({ ...latest, error: errorMessage(error) })
    }
  }
}

function readJobStatuses(arkAccountId: string): string {
  return useArkSwapsStore
    .getState()
    .jobs.filter((job) => job.arkAccountId === arkAccountId)
    .map((job) => `${job.id}:${job.status}`)
    .join(',')
}

async function advanceAccountJobs(arkAccountId: string): Promise<boolean> {
  const now = Date.now()
  const jobIds = useArkSwapsStore
    .getState()
    .jobs.filter(
      (job) =>
        job.arkAccountId === arkAccountId &&
        isArkSwapJobRunnable(job) &&
        isArkSwapJobRetryDue(jobFailures.get(job.id), now) &&
        !runningJobIds.has(job.id)
    )
    .map((job) => job.id)
  if (jobIds.length === 0) {
    return false
  }
  const statusesBefore = readJobStatuses(arkAccountId)
  await ensureArkWalletOpen(arkAccountId)
  await Promise.all(
    jobIds.map((jobId) => withJobLock(jobId, () => advanceJob(jobId)))
  )
  return readJobStatuses(arkAccountId) !== statusesBefore
}

/**
 * Moves every runnable swap one step forward. Safe to call repeatedly: each
 * job runs at most once at a time. Resolves to the Ark accounts whose swaps
 * changed status, so their balances can be refreshed.
 */
export async function advanceArkSwapJobs(): Promise<string[]> {
  const arkAccountIds = [
    ...new Set(
      useArkSwapsStore
        .getState()
        .jobs.filter(isArkSwapJobRunnable)
        .map((job) => job.arkAccountId)
    )
  ]
  const results = await Promise.allSettled(
    arkAccountIds.map(async (arkAccountId) => ({
      arkAccountId,
      changed: await advanceAccountJobs(arkAccountId)
    }))
  )
  return results.flatMap((result) =>
    result.status === 'fulfilled' && result.value.changed
      ? [result.value.arkAccountId]
      : []
  )
}

function getJobAwaitingInvoice(jobId: string): ArkOnchainToLightningJob {
  const job = getArkSwapJob(jobId)
  if (job?.kind !== 'onchainToLightning' || !canSubmitArkSwapInvoice(job)) {
    throw new Error(t('ark.swap.error.notAwaitingInvoice'))
  }
  return job
}

async function payLateInvoice(jobId: string, rawInvoice: string) {
  const job = getJobAwaitingInvoice(jobId)
  const arkAccount = getArkAccountOrThrow(job.arkAccountId)
  const invoice = requirePayableInvoice(rawInvoice, arkAccount)
  await ensureArkWalletOpen(job.arkAccountId)
  await assertInvoiceFitsBoard(arkAccount, invoice.amountSats, job.amountSats)
  // The job may have been dismissed while the checks above awaited.
  const current = getJobAwaitingInvoice(jobId)
  await payJobInvoice({
    ...current,
    invoice: invoice.invoice,
    invoiceExpiresAt: invoice.expiresAt,
    paymentHash: invoice.paymentHash
  })
}

/**
 * Pays an invoice supplied after boarding, or after an earlier payment of
 * the swap failed. Only valid once the board is spendable, and only for an
 * invoice the boarded amount covers. Bark cannot pin a payment to the board's
 * VTXOs, so it is paid from the Ark balance, capped at the boarded amount.
 */
export async function submitArkSwapInvoice(
  jobId: string,
  rawInvoice: string
): Promise<void> {
  const ran = await withJobLock(jobId, () => payLateInvoice(jobId, rawInvoice))
  if (!ran) {
    throw new Error(t('ark.swap.error.busy'))
  }
}
