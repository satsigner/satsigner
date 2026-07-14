import {
  Config,
  type FeeEstimate,
  type LightningSendStatus,
  LightningSendStatus_Tags,
  type Movement,
  Network as BarkNetwork,
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
import type {
  ArkBalance,
  ArkBolt11Invoice,
  ArkDerivedAddress,
  ArkFeeEstimate,
  ArkLightningSendResult,
  ArkMovement,
  ArkMovementEvent,
  ArkNotificationListener,
  ArkNotificationUnsubscribe,
  ArkOnchainBalance,
  ArkPendingBoard,
  ArkServer,
  ArkServerInfo,
  ArkVtxo,
  ArkWalletArgs,
  ArkWalletProvider
} from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'
import { isArkRefreshSubsystemName } from '@/utils/arkMovement'
import { filterCurrentArkVtxos } from '@/utils/arkVtxo'
import { decodeLightningInvoice } from '@/utils/lightningInvoiceDecoder'

const ROUND_TX_REQUIRED_CONFIRMATIONS = 0 // Later allow users to change this on the Ark settings
const LIGHTNING_SEND_WAIT = false
const walletCache = new Map<string, WalletLike>()
const walletArgsCache = new Map<string, ArkWalletArgs>()
const onchainWalletCache = new Map<string, OnchainWalletLike>()
const inflightOnchainOpens = new Map<string, Promise<OnchainWalletLike>>()
const inflightOpens = new Map<string, Promise<void>>()
const inflightSyncs = new Map<string, Promise<void>>()
const notificationsCache = new Map<string, WalletNotifications>()
const activeUnsubscribes = new Map<string, Set<ArkNotificationUnsubscribe>>()

function appNetworkToBarkNetwork(network: Network): BarkNetwork {
  switch (network) {
    case 'bitcoin':
      return BarkNetwork.Bitcoin
    case 'signet':
      return BarkNetwork.Signet
    case 'testnet':
      return BarkNetwork.Testnet
    default:
      return BarkNetwork.Signet
  }
}

function buildConfig(server: ArkServer): Config {
  return Config.create({
    esploraAddress: server.esploraUrl,
    roundTxRequiredConfirmations: ROUND_TX_REQUIRED_CONFIRMATIONS,
    serverAddress: server.arkUrl
  })
}

function getCachedWallet(accountId: string): WalletLike {
  const wallet = walletCache.get(accountId)
  if (!wallet) {
    throw new Error(`Ark wallet not opened for account '${accountId}'`)
  }
  return wallet
}

async function createWallet(args: ArkWalletArgs): Promise<void> {
  const wallet = await Wallet.open(
    appNetworkToBarkNetwork(args.server.network),
    args.mnemonic,
    buildConfig(args.server),
    {
      createIfNotExists: true,
      createWithoutServer: false,
      datadir: args.datadir,
      runDaemon: false
    }
  )
  walletCache.set(args.accountId, wallet)
  walletArgsCache.set(args.accountId, args)
}

async function openAndCacheWallet(args: ArkWalletArgs): Promise<void> {
  const wallet = await Wallet.open(
    appNetworkToBarkNetwork(args.server.network),
    args.mnemonic,
    buildConfig(args.server),
    {
      createIfNotExists: true,
      createWithoutServer: false,
      datadir: args.datadir,
      runDaemon: true
    }
  )
  walletCache.set(args.accountId, wallet)
  walletArgsCache.set(args.accountId, args)
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
      status: event.inner.movement.status,
      type: 'created'
    }
  }
  if (event.tag === WalletNotification_Tags.MovementUpdated) {
    return {
      accountId,
      effectiveBalanceSats: Number(event.inner.movement.effectiveBalanceSats),
      movementId: event.inner.movement.id,
      status: event.inner.movement.status,
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
  const invoice = await wallet.bolt11Invoice(BigInt(amountSats), description)
  return {
    amountSats: Number(invoice.amountSats),
    invoice: invoice.invoice
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

const NO_HTLC_VTXOS_LOCKED = 0

function mapLightningSendStatus(
  status: LightningSendStatus,
  fallbackInvoice: string,
  fallbackAmountSats: number
): ArkLightningSendResult {
  if (status.tag === LightningSendStatus_Tags.Paid) {
    return {
      amountSats: fallbackAmountSats,
      htlcVtxoCount: NO_HTLC_VTXOS_LOCKED,
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
    htlcVtxoCount: NO_HTLC_VTXOS_LOCKED,
    invoice: fallbackInvoice
  }
}

function sendArkoor(
  accountId: string,
  arkAddress: string,
  amountSats: number
): Promise<void> {
  const wallet = getCachedWallet(accountId)
  return wallet.sendArkoorPayment(arkAddress, BigInt(amountSats))
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
    LIGHTNING_SEND_WAIT
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
    LIGHTNING_SEND_WAIT
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
    state: vtxo.state
  }
}

async function listSpendableVtxos(accountId: string): Promise<ArkVtxo[]> {
  const wallet = getCachedWallet(accountId)
  const vtxos = await wallet.spendableVtxos()
  return vtxos.map((vtxo) => mapVtxo(vtxo, true))
}

async function listAllVtxos(accountId: string): Promise<ArkVtxo[]> {
  const wallet = getCachedWallet(accountId)
  const [all, spendable] = await Promise.all([
    wallet.allVtxos(),
    wallet.spendableVtxos()
  ])
  const spendableIds = new Set(spendable.map((vtxo) => vtxo.id))
  return filterCurrentArkVtxos(
    all.map((vtxo) => mapVtxo(vtxo, spendableIds.has(vtxo.id)))
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

const PENDING_RACE_TIMEOUT_MS = 30_000
const PENDING_TXID = 'pending'

function raceMovementCreated(
  label: string,
  accountId: string,
  matchesMovement: (movement: Movement) => boolean,
  operation: Promise<string>
): Promise<string> {
  const notifications = getOrCreateNotifications(accountId)
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
      settle(() =>
        reject(new Error(`${label}: no movement created within timeout`))
      )
    }, PENDING_RACE_TIMEOUT_MS)

    const unsubscribe = notifications.subscribe((event) => {
      if (event.tag !== WalletNotification_Tags.MovementCreated) {
        return
      }
      if (!matchesMovement(event.inner.movement)) {
        return
      }
      settle(() => resolve(PENDING_TXID))
    })

    // A failure after the movement notification already resolved this promise
    // is intentionally not re-thrown: it surfaces as a movement status update.
    async function watchOperation() {
      try {
        const txid = await operation
        settle(() => resolve(txid))
      } catch (error) {
        settle(() => reject(error))
      }
    }

    void watchOperation()
  })
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
    wallet.offboardVtxos(vtxoIds, bitcoinAddress)
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

// Refreshing joins the next Ark round, which can take minutes; resolve as
// soon as the wallet records the refresh movement instead of awaiting it.
function refreshVtxos(accountId: string, vtxoIds: string[]): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return raceMovementCreated(
    'ark-refresh',
    accountId,
    (movement) => isArkRefreshSubsystemName(movement.subsystemName),
    wallet.refreshVtxos(vtxoIds).then((txid) => txid ?? '')
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
    wallet.sendOnchain(bitcoinAddress, BigInt(amountSats))
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

async function openOnchainWallet(
  args: ArkWalletArgs
): Promise<OnchainWalletLike> {
  const onchainWallet = await OnchainWallet.default_(
    appNetworkToBarkNetwork(args.server.network),
    args.mnemonic,
    buildConfig(args.server),
    args.datadir
  )
  // wallet released while the open was inflight; don't resurrect the cache
  if (walletArgsCache.get(args.accountId) !== args) {
    if (OnchainWallet.instanceOf(onchainWallet)) {
      onchainWallet.uniffiDestroy()
    }
    throw new Error(`Ark wallet released for account '${args.accountId}'`)
  }
  onchainWalletCache.set(args.accountId, onchainWallet)
  return onchainWallet
}

async function getOrCreateOnchainWallet(
  accountId: string
): Promise<OnchainWalletLike> {
  const cached = onchainWalletCache.get(accountId)
  if (cached) {
    return cached
  }
  const inflight = inflightOnchainOpens.get(accountId)
  if (inflight) {
    return inflight
  }
  const args = walletArgsCache.get(accountId)
  if (!args) {
    throw new Error(`Ark wallet not opened for account '${accountId}'`)
  }
  const promise = openOnchainWallet(args)
  inflightOnchainOpens.set(accountId, promise)
  try {
    return await promise
  } finally {
    inflightOnchainOpens.delete(accountId)
  }
}

async function fetchOnchainBalance(
  accountId: string
): Promise<ArkOnchainBalance> {
  const onchainWallet = await getOrCreateOnchainWallet(accountId)
  await onchainWallet.sync()
  const balance = await onchainWallet.balance()
  return {
    confirmedSats: Number(balance.confirmedSats),
    pendingSats: Number(balance.pendingSats),
    totalSats: Number(balance.totalSats)
  }
}

async function newOnchainAddress(accountId: string): Promise<string> {
  const onchainWallet = await getOrCreateOnchainWallet(accountId)
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
  const onchainWallet = await getOrCreateOnchainWallet(accountId)
  const pendingBoard =
    amountSats === undefined
      ? await wallet.boardAll(onchainWallet)
      : await wallet.boardAmount(onchainWallet, BigInt(amountSats))
  return mapPendingBoard(pendingBoard)
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
    minBoardAmountSats: Number(info.minBoardAmountSats),
    requiredBoardConfirmations: info.requiredBoardConfirmations
  }
}

async function fetchBalance(accountId: string): Promise<ArkBalance> {
  const wallet = getCachedWallet(accountId)
  const balance = await wallet.balance()
  return {
    claimableLightningReceiveSats: Number(
      balance.claimableLightningReceiveSats
    ),
    pendingBoardSats: Number(balance.pendingBoardSats),
    pendingExitSats: Number(balance.pendingExitSats),
    pendingInRoundSats: Number(balance.pendingInRoundSats),
    pendingLightningSendSats: Number(balance.pendingLightningSendSats),
    spendableSats: Number(balance.spendableSats)
  }
}

const barkProvider: ArkWalletProvider = {
  board,
  createBolt11Invoice,
  createWallet,
  deriveAddresses,
  estimateArkoorFee,
  estimateBoardFee,
  estimateLightningSendFee,
  estimateOffboardFee,
  estimateRefreshFee,
  estimateSendOnchainFee,
  fetchBalance,
  fetchMovements,
  fetchOnchainBalance,
  fetchServerInfo,
  listAllVtxos,
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
  sendOnchain,
  serverId: 'second',
  startExit,
  subscribeNotifications,
  syncWallet
}

registerArkProvider(barkProvider)
