import {
  Config,
  type EmergencyExitFeeEstimate,
  type ExitState,
  ExitState_Tags,
  type ExitTx,
  ExitTxStatus_Tags,
  extractTxFromPsbt,
  type FeeEstimate,
  type LightningReceive,
  type LightningSendStatus,
  LightningSendStatus_Tags,
  type Movement,
  Network as BarkNetwork,
  type OnchainUtxo,
  OnchainUtxo_Tags,
  OnchainWallet,
  type OnchainWalletLike,
  type PendingBoard,
  type Vtxo,
  Wallet,
  WalletNotification_Tags,
  WalletNotifications,
  type WalletLike,
  type WalletNotification
} from '@secondts/bark-react-native'

import { registerArkProvider } from '@/api/ark/registry'
import {
  ARK_BOARD_PAYJOIN_NATIVE_MISSING,
  ARK_LIGHTNING_RECEIVE_SETTLED_STATE,
  ARK_LIGHTNING_RETRY_FOR_SECS,
  ARK_LIGHTNING_SEND_WAIT,
  ARK_NO_HTLC_VTXOS_LOCKED,
  ARK_ONCHAIN_MIN_FEE_RATE_SAT_PER_VB,
  ARK_PENDING_RACE_TIMEOUT_MS,
  ARK_PENDING_TXID,
  ARK_ROUND_TX_REQUIRED_CONFIRMATIONS,
  ARK_SAT_PER_KWU_PER_SAT_PER_VB
} from '@/constants/ark'
import type {
  ArkBalance,
  ArkBoardFundingInfo,
  ArkBolt11Invoice,
  ArkDerivedAddress,
  ArkEmergencyExitFee,
  ArkExit,
  ArkExitClaimDraft,
  ArkFeeEstimate,
  ArkLightningReceive,
  ArkLightningSendResult,
  ArkLightningSendState,
  ArkMovement,
  ArkMovementEvent,
  ArkNotificationListener,
  ArkNotificationUnsubscribe,
  ArkOnchainBalance,
  ArkOnchainFeeRates,
  ArkOnchainUtxo,
  ArkPendingBoard,
  ArkServer,
  ArkServerInfo,
  ArkVtxo,
  ArkWalletArgs,
  ArkWalletProvider
} from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'
import { ArkOperationBusyError } from '@/utils/arkError'
import {
  getQueuedRefreshInputVtxoIds,
  isArkRefreshMovement
} from '@/utils/arkMovement'
import {
  type ArkBusyVtxoIds,
  filterCurrentArkVtxos,
  isArkVtxoBusy,
  moveBusyArkVtxosOutOfSpendable
} from '@/utils/arkVtxo'
import { decodeLightningInvoice } from '@/utils/lightningInvoiceDecoder'

const walletCache = new Map<string, WalletLike>()
const walletArgsCache = new Map<string, ArkWalletArgs>()
const onchainWalletCache = new Map<string, OnchainWalletLike>()
const inflightOpens = new Map<string, Promise<void>>()
const inflightSyncs = new Map<string, Promise<void>>()
const notificationsCache = new Map<string, WalletNotifications>()
const activeUnsubscribes = new Map<string, Set<ArkNotificationUnsubscribe>>()
// Operations still running in the wallet that block a new one with the same
// key, counted so each one releases only its own hold. Starting the same one
// again before it settles could spend the same funds twice.
const heldOperations = new Map<string, number>()

function appNetworkToBarkNetwork(network: Network): BarkNetwork {
  switch (network) {
    case 'bitcoin': {
      return BarkNetwork.Bitcoin
    }
    case 'signet': {
      return BarkNetwork.Signet
    }
    case 'testnet': {
      return BarkNetwork.Testnet
    }
    default: {
      return BarkNetwork.Signet
    }
  }
}

function buildConfig(server: ArkServer): Config {
  return Config.create({
    esploraAddress: server.esploraUrl,
    roundTxRequiredConfirmations: ARK_ROUND_TX_REQUIRED_CONFIRMATIONS,
    serverAddress: server.arkUrl
  })
}

type BarkBoardPayjoinWallet = Pick<
  WalletLike,
  'boardFundingAddress' | 'boardPsbt'
>

function getBoardPayjoinWallet(accountId: string): BarkBoardPayjoinWallet {
  const wallet = getCachedWallet(accountId)
  if (
    typeof wallet.boardFundingAddress !== 'function' ||
    typeof wallet.boardPsbt !== 'function'
  ) {
    throw new TypeError(ARK_BOARD_PAYJOIN_NATIVE_MISSING)
  }
  return wallet
}

function getCachedWallet(accountId: string): WalletLike {
  const wallet = walletCache.get(accountId)
  if (!wallet) {
    throw new Error(`Ark wallet not opened for account '${accountId}'`)
  }
  return wallet
}

// Since bark 0.12, boarding, exits and the daemon use the onchain wallet
// supplied at open time (`WalletOpenArgs.onchain`), so it must be created
// upfront instead of lazily.
async function openWalletWithOnchain(args: ArkWalletArgs): Promise<void> {
  const onchainWallet = await OnchainWallet.default_(
    appNetworkToBarkNetwork(args.server.network),
    args.mnemonic,
    buildConfig(args.server),
    args.datadir
  )
  try {
    const wallet = await Wallet.open(
      appNetworkToBarkNetwork(args.server.network),
      args.mnemonic,
      buildConfig(args.server),
      {
        createIfNotExists: true,
        createWithoutServer: false,
        datadir: args.datadir,
        onchain: onchainWallet,
        runDaemon: true,
        skipRecovery: false
      }
    )
    walletCache.set(args.accountId, wallet)
  } catch (error) {
    if (OnchainWallet.instanceOf(onchainWallet)) {
      onchainWallet.uniffiDestroy()
    }
    throw error
  }
  onchainWalletCache.set(args.accountId, onchainWallet)
  walletArgsCache.set(args.accountId, args)
}

// The created wallet stays cached and openWallet skips cached wallets, so the
// daemon has to start here or it never runs for this wallet until a restart.
async function createWallet(args: ArkWalletArgs): Promise<void> {
  await openWalletWithOnchain(args)
}

async function openAndCacheWallet(args: ArkWalletArgs): Promise<void> {
  await openWalletWithOnchain(args)
  const wallet = getCachedWallet(args.accountId)
  try {
    await wallet.sync()
  } catch (error) {
    // Evict so the next open retries the initial sync instead of serving
    // a cached wallet that never completed it.
    releaseWallet(args.accountId)
    throw error
  }
}

async function syncWallet(accountId: string): Promise<void> {
  const inflight = inflightSyncs.get(accountId)
  if (inflight) {
    return inflight
  }
  const wallet = getCachedWallet(accountId)
  const promise = wallet.sync()
  inflightSyncs.set(accountId, promise)
  try {
    await promise
  } finally {
    inflightSyncs.delete(accountId)
  }
}

async function openWallet(args: ArkWalletArgs): Promise<void> {
  if (walletCache.has(args.accountId)) {
    return
  }
  const inflight = inflightOpens.get(args.accountId)
  if (inflight) {
    return inflight
  }
  const promise = openAndCacheWallet(args)
  inflightOpens.set(args.accountId, promise)
  try {
    await promise
  } finally {
    inflightOpens.delete(args.accountId)
  }
}

function mapWalletNotification(
  accountId: string,
  event: WalletNotification
): ArkMovementEvent | null {
  if (event.tag === WalletNotification_Tags.MovementCreated) {
    return {
      accountId,
      effectiveBalanceSats: Number(event.inner.movement.effectiveBalanceSats),
      movementId: event.inner.movement.id,
      paymentHash: event.inner.movement.paymentHash,
      status: event.inner.movement.status,
      subsystemKind: event.inner.movement.subsystemKind,
      subsystemName: event.inner.movement.subsystemName,
      type: 'created'
    }
  }
  if (event.tag === WalletNotification_Tags.MovementUpdated) {
    return {
      accountId,
      effectiveBalanceSats: Number(event.inner.movement.effectiveBalanceSats),
      movementId: event.inner.movement.id,
      paymentHash: event.inner.movement.paymentHash,
      status: event.inner.movement.status,
      subsystemKind: event.inner.movement.subsystemKind,
      subsystemName: event.inner.movement.subsystemName,
      type: 'updated'
    }
  }
  return null
}

function getOrCreateNotifications(accountId: string): WalletNotifications {
  const existing = notificationsCache.get(accountId)
  if (existing) {
    return existing
  }
  const wallet = getCachedWallet(accountId)
  const notifications = new WalletNotifications(wallet)
  notificationsCache.set(accountId, notifications)
  return notifications
}

function getOrCreateUnsubscribes(
  accountId: string
): Set<ArkNotificationUnsubscribe> {
  const existing = activeUnsubscribes.get(accountId)
  if (existing) {
    return existing
  }
  const set = new Set<ArkNotificationUnsubscribe>()
  activeUnsubscribes.set(accountId, set)
  return set
}

function subscribeNotifications(
  accountId: string,
  listener: ArkNotificationListener
): ArkNotificationUnsubscribe {
  const notifications = getOrCreateNotifications(accountId)
  const innerUnsubscribe = notifications.subscribe((event) => {
    const mapped = mapWalletNotification(accountId, event)
    if (mapped) {
      listener(mapped)
    }
  })
  const unsubscribes = getOrCreateUnsubscribes(accountId)
  const unsubscribe: ArkNotificationUnsubscribe = () => {
    innerUnsubscribe()
    unsubscribes.delete(unsubscribe)
  }
  unsubscribes.add(unsubscribe)
  return unsubscribe
}

function releaseWallet(accountId: string): void {
  const unsubscribes = activeUnsubscribes.get(accountId)
  if (unsubscribes) {
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }
    activeUnsubscribes.delete(accountId)
  }
  notificationsCache.delete(accountId)
  const onchainWallet = onchainWalletCache.get(accountId)
  if (onchainWallet && OnchainWallet.instanceOf(onchainWallet)) {
    onchainWallet.uniffiDestroy()
  }
  onchainWalletCache.delete(accountId)
  const wallet = walletCache.get(accountId)
  if (wallet && Wallet.instanceOf(wallet)) {
    wallet.uniffiDestroy()
  }
  walletCache.delete(accountId)
  walletArgsCache.delete(accountId)
}

function newAddress(accountId: string): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return wallet.newAddress()
}

async function deriveAddresses(
  accountId: string,
  startIndex: number,
  count: number
): Promise<ArkDerivedAddress[]> {
  const wallet = getCachedWallet(accountId)
  const indices = Array.from(
    { length: count },
    (_, offset) => startIndex + offset
  )
  const addresses: ArkDerivedAddress[] = []
  for (const index of indices) {
    // peekAddress only returns already-revealed addresses and errors for
    // indices beyond the last derived one, so stop at the first failure.
    try {
      addresses.push({ address: await wallet.peekAddress(index), index })
    } catch {
      break
    }
  }
  return addresses
}

async function createBolt11Invoice(
  accountId: string,
  amountSats: number,
  description?: string
): Promise<ArkBolt11Invoice> {
  const wallet = getCachedWallet(accountId)
  const invoice = await wallet.bolt11Invoice(
    BigInt(amountSats),
    description,
    undefined
  )
  return {
    amountSats: Number(invoice.amountSats),
    invoice: invoice.invoice,
    paymentHash: invoice.paymentHash
  }
}

function mapMovement(movement: Movement): ArkMovement {
  return {
    completedAt: movement.completedAt ?? null,
    createdAt: movement.createdAt,
    effectiveBalanceSats: Number(movement.effectiveBalanceSats),
    exitedVtxoIds: movement.exitedVtxoIds,
    id: movement.id,
    inputVtxoIds: movement.inputVtxoIds,
    intendedBalanceSats: Number(movement.intendedBalanceSats),
    metadataJson: movement.metadataJson,
    offchainFeeSats: Number(movement.offchainFeeSats),
    outputVtxoIds: movement.outputVtxoIds,
    receivedOnAddresses: movement.receivedOnAddresses,
    sentToAddresses: movement.sentToAddresses,
    status: movement.status,
    subsystemKind: movement.subsystemKind,
    subsystemName: movement.subsystemName,
    updatedAt: movement.updatedAt
  }
}

async function fetchMovements(accountId: string): Promise<ArkMovement[]> {
  const wallet = getCachedWallet(accountId)
  const movements = await wallet.history()
  return movements.map(mapMovement)
}

function mapLightningSendStatus(
  status: LightningSendStatus,
  fallbackInvoice: string,
  fallbackAmountSats: number
): ArkLightningSendResult {
  if (status.tag === LightningSendStatus_Tags.Paid) {
    return {
      amountSats: fallbackAmountSats,
      htlcVtxoCount: ARK_NO_HTLC_VTXOS_LOCKED,
      invoice: fallbackInvoice,
      preimage: status.inner.preimage
    }
  }
  if (status.tag === LightningSendStatus_Tags.InProgress) {
    const { send } = status.inner
    return {
      amountSats: Number(send.amountSats),
      htlcVtxoCount: send.htlcVtxoCount,
      invoice: send.invoice
    }
  }
  return {
    amountSats: fallbackAmountSats,
    htlcVtxoCount: ARK_NO_HTLC_VTXOS_LOCKED,
    invoice: fallbackInvoice
  }
}

function mapLightningSendState(
  status: LightningSendStatus
): ArkLightningSendState {
  if (status.tag === LightningSendStatus_Tags.Paid) {
    return { preimage: status.inner.preimage, status: 'paid' }
  }
  if (status.tag === LightningSendStatus_Tags.InProgress) {
    return { status: 'inProgress' }
  }
  return { status: 'unknown' }
}

async function checkLightningSend(
  accountId: string,
  paymentHash: string
): Promise<ArkLightningSendState> {
  const status = await getCachedWallet(accountId).checkLightningPayment(
    paymentHash,
    ARK_LIGHTNING_SEND_WAIT
  )
  return mapLightningSendState(status)
}

async function sendArkoor(
  accountId: string,
  arkAddress: string,
  amountSats: number
): Promise<void> {
  const wallet = getCachedWallet(accountId)
  await wallet.sendArkoorPayment(arkAddress, BigInt(amountSats))
}

function invoiceAmountSats(invoice: string): number {
  try {
    return Number(decodeLightningInvoice(invoice).num_satoshis) || 0
  } catch {
    return 0
  }
}

async function payBolt11(
  accountId: string,
  invoice: string,
  amountSats?: number
): Promise<ArkLightningSendResult> {
  const wallet = getCachedWallet(accountId)
  const amount = amountSats === undefined ? undefined : BigInt(amountSats)
  const status = await wallet.payLightningInvoice(
    invoice,
    amount,
    ARK_LIGHTNING_SEND_WAIT,
    ARK_LIGHTNING_RETRY_FOR_SECS
  )
  return mapLightningSendStatus(
    status,
    invoice,
    amountSats ?? invoiceAmountSats(invoice)
  )
}

async function payLightningAddress(
  accountId: string,
  address: string,
  amountSats: number,
  comment?: string
): Promise<ArkLightningSendResult> {
  const wallet = getCachedWallet(accountId)
  const status = await wallet.payLightningAddress(
    address,
    BigInt(amountSats),
    comment,
    ARK_LIGHTNING_SEND_WAIT,
    ARK_LIGHTNING_RETRY_FOR_SECS
  )
  return mapLightningSendStatus(status, '', amountSats)
}

function mapFeeEstimate(estimate: FeeEstimate): ArkFeeEstimate {
  return {
    feeSats: Number(estimate.feeSats),
    grossAmountSats: Number(estimate.grossAmountSats),
    netAmountSats: Number(estimate.netAmountSats),
    vtxoIdsSpent: estimate.vtxosSpent
  }
}

async function estimateArkoorFee(
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  const wallet = getCachedWallet(accountId)
  const estimate = await wallet.estimateArkoorPaymentFee(BigInt(amountSats))
  return mapFeeEstimate(estimate)
}

async function estimateLightningSendFee(
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  const wallet = getCachedWallet(accountId)
  const estimate = await wallet.estimateLightningSendFee(BigInt(amountSats))
  return mapFeeEstimate(estimate)
}

function mapVtxo(vtxo: Vtxo, spendable: boolean): ArkVtxo {
  return {
    amountSats: Number(vtxo.amountSats),
    exitDepth: vtxo.exitDepth,
    expiryHeight: vtxo.expiryHeight,
    id: vtxo.id,
    kind: vtxo.kind,
    spendable,
    state: vtxo.state.tag
  }
}

// bark keeps a VTXO spendable until its exit commits on-chain or its queued
// refresh round starts, so it could be picked again and spent twice. Inputs
// of a started round are already locked and outside spendableVtxos.
async function fetchBusyVtxoIds(wallet: WalletLike): Promise<ArkBusyVtxoIds> {
  const [exitVtxos, movements] = await Promise.all([
    wallet.getExitVtxos(),
    wallet.history()
  ])
  const liveExits = exitVtxos.filter(
    (exit) => exit.state.tag !== ExitState_Tags.Canceled
  )
  return {
    exiting: new Set(liveExits.map((exit) => exit.vtxoId)),
    inRound: new Set(getQueuedRefreshInputVtxoIds(movements.map(mapMovement)))
  }
}

async function listSpendableVtxos(accountId: string): Promise<ArkVtxo[]> {
  const wallet = getCachedWallet(accountId)
  const [vtxos, busy] = await Promise.all([
    wallet.spendableVtxos(),
    fetchBusyVtxoIds(wallet)
  ])
  return vtxos
    .filter((vtxo) => !isArkVtxoBusy(vtxo.id, busy))
    .map((vtxo) => mapVtxo(vtxo, true))
}

async function listAllVtxos(accountId: string): Promise<ArkVtxo[]> {
  const wallet = getCachedWallet(accountId)
  const [all, spendable, busy] = await Promise.all([
    wallet.allVtxos(),
    wallet.spendableVtxos(),
    fetchBusyVtxoIds(wallet)
  ])
  const spendableIds = new Set(spendable.map((vtxo) => vtxo.id))
  return filterCurrentArkVtxos(
    all.map((vtxo) =>
      mapVtxo(vtxo, spendableIds.has(vtxo.id) && !isArkVtxoBusy(vtxo.id, busy))
    )
  )
}

async function startExit(accountId: string, vtxoIds?: string[]): Promise<void> {
  const wallet = getCachedWallet(accountId)
  if (vtxoIds === undefined) {
    await wallet.startExitForEntireWallet()
    return
  }
  if (vtxoIds.length === 0) {
    throw new Error('No VTXOs selected for exit')
  }
  await wallet.startExitForVtxos(vtxoIds)
}

type ArkExitStateFields = Pick<
  ArkExit,
  | 'awaitingCpfpBroadcast'
  | 'claimTxid'
  | 'claimableAtHeight'
  | 'confirmedTxCount'
  | 'status'
  | 'tipHeight'
  | 'totalTxCount'
>

function countConfirmedExitTxs(transactions: ExitTx[]): number {
  return transactions.filter(
    (transaction) => transaction.status.tag === ExitTxStatus_Tags.Confirmed
  ).length
}

function isAwaitingCpfpBroadcast(transactions: ExitTx[]): boolean {
  return transactions.some(
    (transaction) =>
      transaction.status.tag === ExitTxStatus_Tags.AwaitingCpfpBroadcast
  )
}

function mapExitState(state: ExitState): ArkExitStateFields {
  const { tipHeight } = state.inner
  switch (state.tag) {
    case ExitState_Tags.Start: {
      return { status: 'starting', tipHeight }
    }
    case ExitState_Tags.Processing: {
      return {
        awaitingCpfpBroadcast: isAwaitingCpfpBroadcast(
          state.inner.transactions
        ),
        confirmedTxCount: countConfirmedExitTxs(state.inner.transactions),
        status: 'processing',
        tipHeight,
        totalTxCount: state.inner.transactions.length
      }
    }
    case ExitState_Tags.AwaitingDelta: {
      return {
        claimableAtHeight: state.inner.claimableHeight,
        status: 'awaitingDelta',
        tipHeight
      }
    }
    case ExitState_Tags.Claimable: {
      return {
        claimableAtHeight: state.inner.claimableSince.height,
        status: 'claimable',
        tipHeight
      }
    }
    case ExitState_Tags.ClaimInProgress: {
      return {
        claimTxid: state.inner.claimTxid,
        status: 'claimInProgress',
        tipHeight
      }
    }
    case ExitState_Tags.Claimed: {
      return { claimTxid: state.inner.txid, status: 'claimed', tipHeight }
    }
    case ExitState_Tags.VtxoAlreadySpent: {
      return { status: 'alreadySpent', tipHeight }
    }
    case ExitState_Tags.VtxoSwept: {
      return { status: 'swept', tipHeight }
    }
    default: {
      return { status: 'canceled', tipHeight }
    }
  }
}

// Exit statuses carry no amount, and finished exits leave getExitVtxos, so the
// amount comes from the VTXO record when the wallet still has it.
async function listExits(accountId: string): Promise<ArkExit[]> {
  const wallet = getCachedWallet(accountId)
  const statuses = await wallet.listAllExits(false, false)
  return Promise.all(
    statuses.map(async (status) => {
      const vtxo = await wallet
        .getVtxoById(status.vtxoId)
        .catch(() => undefined)
      return {
        ...mapExitState(status.state),
        amountSats: vtxo ? Number(vtxo.amountSats) : undefined,
        vtxoId: status.vtxoId
      }
    })
  )
}

function syncExits(accountId: string): Promise<void> {
  return getCachedWallet(accountId).syncExits()
}

function mapEmergencyExitFee(
  estimate: EmergencyExitFeeEstimate
): ArkEmergencyExitFee {
  return {
    claimFeeSats: Number(estimate.claimFeeSats),
    exitBroadcastFeeSats: Number(estimate.exitBroadcastFeeSats),
    feeRateSatPerVb: Number(estimate.feeRateSatPerVb),
    totalFeeSats: Number(estimate.totalFeeSats)
  }
}

async function estimateEmergencyExitFee(
  accountId: string,
  vtxoIds: string[]
): Promise<ArkEmergencyExitFee> {
  const estimate = await getCachedWallet(accountId).estimateEmergencyExitFee(
    vtxoIds,
    undefined,
    undefined,
    undefined
  )
  return mapEmergencyExitFee(estimate)
}

async function buildExitClaim(
  accountId: string,
  vtxoIds: string[],
  bitcoinAddress: string,
  feeRateSatPerVb: number
): Promise<ArkExitClaimDraft> {
  if (vtxoIds.length === 0) {
    throw new Error('No exits selected for claim')
  }
  const claim = await getCachedWallet(accountId).drainExits(
    vtxoIds,
    false,
    bitcoinAddress,
    BigInt(feeRateSatPerVb)
  )
  return {
    feeSats: Number(claim.feeSats),
    psbtBase64: claim.psbtBase64,
    skippedVtxoIds: claim.skippedVtxoIds,
    vtxoIds: claim.vtxoIds
  }
}

async function signExitClaim(
  accountId: string,
  psbtBase64: string
): Promise<string> {
  const signedPsbt =
    await getCachedWallet(accountId).signExitClaimInputs(psbtBase64)
  return extractTxFromPsbt(signedPsbt)
}

function holdOperation(operationKey: string) {
  heldOperations.set(operationKey, (heldOperations.get(operationKey) ?? 0) + 1)
}

function releaseOperation(operationKey: string) {
  const remaining = (heldOperations.get(operationKey) ?? 0) - 1
  if (remaining > 0) {
    heldOperations.set(operationKey, remaining)
    return
  }
  heldOperations.delete(operationKey)
}

/**
 * A timed-out operation holds its key until it settles. An exclusive one
 * holds it from the start, because a concurrent one with the same matcher
 * could take its movement notification.
 */
function raceMovementCreated(
  label: string,
  accountId: string,
  matchesMovement: (movement: Movement) => boolean,
  startOperation: () => Promise<string>,
  { exclusive = false }: { exclusive?: boolean } = {}
): Promise<string> {
  const operationKey = `${accountId}:${label}`
  if (heldOperations.has(operationKey)) {
    return Promise.reject(new ArkOperationBusyError())
  }
  const hold = { held: false }
  function holdOnce() {
    if (!hold.held) {
      hold.held = true
      holdOperation(operationKey)
    }
  }
  if (exclusive) {
    holdOnce()
  }
  const notifications = getOrCreateNotifications(accountId)
  const operation = startOperation()
  return new Promise<string>((resolve, reject) => {
    let settled = false

    function settle(complete: () => void) {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      unsubscribe()
      complete()
    }

    const timer = setTimeout(() => {
      settle(() => {
        holdOnce()
        reject(new Error(`${label}: no movement created within timeout`))
      })
    }, ARK_PENDING_RACE_TIMEOUT_MS)

    const unsubscribe = notifications.subscribe((event) => {
      if (event.tag !== WalletNotification_Tags.MovementCreated) {
        return
      }
      if (!matchesMovement(event.inner.movement)) {
        return
      }
      settle(() => resolve(ARK_PENDING_TXID))
    })

    // A failure after the movement notification already resolved this promise
    // is intentionally not re-thrown: it surfaces as a movement status update.
    async function watchOperation() {
      try {
        const txid = await operation
        settle(() => resolve(txid))
      } catch (error) {
        settle(() => reject(error))
      } finally {
        if (hold.held) {
          releaseOperation(operationKey)
        }
      }
    }

    void watchOperation()
  })
}

async function offboardWalletVtxos(
  wallet: WalletLike,
  vtxoIds: string[],
  bitcoinAddress: string
): Promise<string> {
  const result = await wallet.offboardVtxos(vtxoIds, bitcoinAddress)
  return result.txid
}

function offboardVtxos(
  accountId: string,
  vtxoIds: string[],
  bitcoinAddress: string
): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return raceMovementCreated(
    'ark-offboard',
    accountId,
    (movement) => movement.subsystemKind === 'offboard',
    () => offboardWalletVtxos(wallet, vtxoIds, bitcoinAddress)
  )
}

async function estimateOffboardFee(
  accountId: string,
  bitcoinAddress: string,
  vtxoIds: string[]
): Promise<ArkFeeEstimate> {
  const wallet = getCachedWallet(accountId)
  const estimate = await wallet.estimateOffboardFee(bitcoinAddress, vtxoIds)
  return mapFeeEstimate(estimate)
}

async function refreshWalletVtxos(
  wallet: WalletLike,
  vtxoIds: string[]
): Promise<string> {
  const txid = await wallet.refreshVtxos(vtxoIds)
  return txid ?? ''
}

// Refreshing joins the next Ark round, which can take minutes; resolve as
// soon as the wallet records the refresh movement instead of awaiting it.
function refreshVtxos(accountId: string, vtxoIds: string[]): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return raceMovementCreated(
    'ark-refresh',
    accountId,
    isArkRefreshMovement,
    () => refreshWalletVtxos(wallet, vtxoIds)
  )
}

async function estimateRefreshFee(
  accountId: string,
  vtxoIds: string[]
): Promise<ArkFeeEstimate> {
  const wallet = getCachedWallet(accountId)
  const estimate = await wallet.estimateRefreshFee(vtxoIds)
  return mapFeeEstimate(estimate)
}

async function offboardToAddress(
  wallet: WalletLike,
  bitcoinAddress: string,
  amountSats: number
): Promise<string> {
  const { txid } = await wallet.sendOnchain(bitcoinAddress, BigInt(amountSats))
  return txid
}

function sendOnchain(
  accountId: string,
  bitcoinAddress: string,
  amountSats: number
): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return raceMovementCreated(
    'ark-sendOnchain',
    accountId,
    (movement) => movement.subsystemKind === 'send_onchain',
    () => offboardToAddress(wallet, bitcoinAddress, amountSats),
    { exclusive: true }
  )
}

async function estimateSendOnchainFee(
  accountId: string,
  bitcoinAddress: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  const wallet = getCachedWallet(accountId)
  const estimate = await wallet.estimateSendOnchainFee(
    bitcoinAddress,
    BigInt(amountSats)
  )
  return mapFeeEstimate(estimate)
}

function getCachedOnchainWallet(accountId: string): OnchainWalletLike {
  const onchainWallet = onchainWalletCache.get(accountId)
  if (!onchainWallet) {
    throw new Error(`Ark wallet not opened for account '${accountId}'`)
  }
  return onchainWallet
}

async function fetchOnchainBalance(
  accountId: string
): Promise<ArkOnchainBalance> {
  const onchainWallet = getCachedOnchainWallet(accountId)
  await onchainWallet.sync()
  const balance = await onchainWallet.balance()
  return {
    confirmedSats: Number(balance.confirmedSats),
    pendingSats: Number(balance.pendingSats),
    totalSats: Number(balance.totalSats)
  }
}

function newOnchainAddress(accountId: string): Promise<string> {
  const onchainWallet = getCachedOnchainWallet(accountId)
  return onchainWallet.newAddress()
}

function mapPendingBoard(pendingBoard: PendingBoard): ArkPendingBoard {
  return {
    amountSats: Number(pendingBoard.amountSats),
    txid: pendingBoard.txid,
    vtxoId: pendingBoard.vtxoId
  }
}

async function board(
  accountId: string,
  amountSats?: number
): Promise<ArkPendingBoard> {
  const wallet = getCachedWallet(accountId)
  const pendingBoard =
    amountSats === undefined
      ? await wallet.boardAll()
      : await wallet.boardAmount(BigInt(amountSats))
  return mapPendingBoard(pendingBoard)
}

async function boardFundingAddress(
  accountId: string
): Promise<ArkBoardFundingInfo> {
  const wallet = getBoardPayjoinWallet(accountId)
  const info = await wallet.boardFundingAddress()
  return {
    address: info.address,
    expiryHeight: info.expiryHeight,
    keypairIndex: info.keypairIndex
  }
}

async function boardPsbt(
  accountId: string,
  psbtBase64: string,
  keypairIndex: number,
  expiryHeight: number
): Promise<ArkPendingBoard> {
  const wallet = getBoardPayjoinWallet(accountId)
  const pendingBoard = await wallet.boardPsbt(
    psbtBase64,
    keypairIndex,
    expiryHeight
  )
  return mapPendingBoard(pendingBoard)
}

async function estimateLightningReceiveFee(
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  const wallet = getCachedWallet(accountId)
  const estimate = await wallet.estimateLightningReceiveFee(BigInt(amountSats))
  return mapFeeEstimate(estimate)
}

async function estimateBoardFee(
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  const wallet = getCachedWallet(accountId)
  const estimate = await wallet.estimateBoardFee(BigInt(amountSats))
  return mapFeeEstimate(estimate)
}

async function listPendingBoards(
  accountId: string
): Promise<ArkPendingBoard[]> {
  const wallet = getCachedWallet(accountId)
  await wallet.syncPendingBoards()
  const pendingBoards = await wallet.pendingBoards()
  return pendingBoards.map(mapPendingBoard)
}

async function fetchServerInfo(
  accountId: string
): Promise<ArkServerInfo | null> {
  const wallet = getCachedWallet(accountId)
  const info = await wallet.arkInfo()
  if (!info) {
    return null
  }
  return {
    maxVtxoExitDepth: info.maxVtxoExitDepth,
    minBoardAmountSats: Number(info.minBoardAmountSats),
    requiredBoardConfirmations: info.requiredBoardConfirmations,
    vtxoExitDelta: info.vtxoExitDelta,
    vtxoLifetime: info.vtxoLifetime
  }
}

async function fetchBalance(accountId: string): Promise<ArkBalance> {
  const wallet = getCachedWallet(accountId)
  const [balance, spendable, busy] = await Promise.all([
    wallet.balance(),
    wallet.spendableVtxos(),
    fetchBusyVtxoIds(wallet)
  ])
  const barkBalance = {
    claimableLightningReceiveSats: Number(
      balance.claimableLightningReceiveSats
    ),
    needsRefreshSats: Number(balance.needsRefreshSats),
    pendingArkoorSendSats: Number(balance.pendingArkoorSendSats),
    pendingBoardSats: Number(balance.pendingBoardSats),
    pendingExitSats: Number(balance.pendingExitSats),
    pendingInRoundSats: Number(balance.pendingInRoundSats),
    pendingLightningSendSats: Number(balance.pendingLightningSendSats),
    pendingOffboardSats: Number(balance.pendingOffboardSats),
    spendableSats: Number(balance.spendableSats)
  }
  return moveBusyArkVtxosOutOfSpendable(
    barkBalance,
    spendable.map((vtxo) => mapVtxo(vtxo, true)),
    busy
  )
}

function fetchTipHeight(accountId: string): Promise<number> {
  return getCachedOnchainWallet(accountId).tipHeight()
}

function fetchVtxoEncoded(accountId: string, vtxoId: string): Promise<string> {
  return getCachedWallet(accountId).vtxoEncoded(vtxoId)
}

async function fetchVtxoState(
  accountId: string,
  vtxoId: string
): Promise<string> {
  const vtxo = await getCachedWallet(accountId).getVtxoById(vtxoId)
  return vtxo.state.tag
}

function mapLightningReceive(receive: LightningReceive): ArkLightningReceive {
  return {
    amountSats:
      receive.amountSats === undefined ? undefined : Number(receive.amountSats),
    invoice: receive.invoice,
    paymentHash: receive.paymentHash,
    settled: receive.state === ARK_LIGHTNING_RECEIVE_SETTLED_STATE,
    state: receive.state
  }
}

async function fetchLightningReceive(
  accountId: string,
  paymentHash: string
): Promise<ArkLightningReceive> {
  const receive =
    await getCachedWallet(accountId).lightningReceiveState(paymentHash)
  return mapLightningReceive(receive)
}

async function claimLightningReceive(
  accountId: string,
  paymentHash: string
): Promise<ArkLightningReceive> {
  const receive = await getCachedWallet(accountId).tryClaimLightningReceive(
    paymentHash,
    false
  )
  return mapLightningReceive(receive)
}

function mapOnchainUtxo(utxo: OnchainUtxo): ArkOnchainUtxo | null {
  if (utxo.tag !== OnchainUtxo_Tags.Local) {
    return null
  }
  const { outpoint, amountSats, confirmationHeight } = utxo.inner
  return {
    amountSats: Number(amountSats),
    confirmed: confirmationHeight !== undefined,
    outpoint: `${outpoint.txid}:${outpoint.vout}`
  }
}

async function listOnchainUtxos(accountId: string): Promise<ArkOnchainUtxo[]> {
  const onchainWallet = getCachedOnchainWallet(accountId)
  await onchainWallet.sync()
  const utxos = await onchainWallet.utxos()
  return utxos
    .map(mapOnchainUtxo)
    .filter((utxo): utxo is ArkOnchainUtxo => utxo !== null)
}

function satPerKwuToSatPerVb(satPerKwu: bigint): number {
  return Math.max(
    ARK_ONCHAIN_MIN_FEE_RATE_SAT_PER_VB,
    Math.ceil(Number(satPerKwu) / ARK_SAT_PER_KWU_PER_SAT_PER_VB)
  )
}

async function fetchOnchainFeeRate(accountId: string): Promise<number> {
  const { regularSatPerKwu } =
    await getCachedOnchainWallet(accountId).feeRates()
  return satPerKwuToSatPerVb(regularSatPerKwu)
}

async function fetchOnchainFeeRates(
  accountId: string
): Promise<ArkOnchainFeeRates> {
  const rates = await getCachedOnchainWallet(accountId).feeRates()
  return {
    fastSatPerVb: satPerKwuToSatPerVb(rates.fastSatPerKwu),
    regularSatPerVb: satPerKwuToSatPerVb(rates.regularSatPerKwu),
    slowSatPerVb: satPerKwuToSatPerVb(rates.slowSatPerKwu)
  }
}

function sendFromOnchain(
  accountId: string,
  bitcoinAddress: string,
  amountSats: number,
  feeRateSatPerVb: number
): Promise<string> {
  return getCachedOnchainWallet(accountId).send(
    bitcoinAddress,
    BigInt(amountSats),
    BigInt(feeRateSatPerVb)
  )
}

const barkProvider: ArkWalletProvider = {
  board,
  boardFundingAddress,
  boardPsbt,
  buildExitClaim,
  checkLightningSend,
  claimLightningReceive,
  createBolt11Invoice,
  createWallet,
  deriveAddresses,
  estimateArkoorFee,
  estimateBoardFee,
  estimateEmergencyExitFee,
  estimateLightningReceiveFee,
  estimateLightningSendFee,
  estimateOffboardFee,
  estimateRefreshFee,
  estimateSendOnchainFee,
  fetchBalance,
  fetchLightningReceive,
  fetchMovements,
  fetchOnchainBalance,
  fetchOnchainFeeRate,
  fetchOnchainFeeRates,
  fetchServerInfo,
  fetchTipHeight,
  fetchVtxoEncoded,
  fetchVtxoState,
  listAllVtxos,
  listExits,
  listOnchainUtxos,
  listPendingBoards,
  listSpendableVtxos,
  newAddress,
  newOnchainAddress,
  offboardVtxos,
  openWallet,
  payBolt11,
  payLightningAddress,
  refreshVtxos,
  releaseWallet,
  sendArkoor,
  sendFromOnchain,
  sendOnchain,
  serverId: 'second',
  signExitClaim,
  startExit,
  subscribeNotifications,
  syncExits,
  syncWallet
}

registerArkProvider(barkProvider)
