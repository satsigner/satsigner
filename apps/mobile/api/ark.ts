import {
  type WalletLike,
  WalletNotifications,
  Network as BarkNetwork,
  Config,
  Wallet,
  type WalletNotification,
  WalletNotification_Tags,
  type Movement,
  type LightningSend,
  type FeeEstimate
} from '@secondts/bark-react-native'

import type {
  ArkServerId,
  ArkBalance,
  ArkMovement,
  ArkLightningSendResult,
  ArkFeeEstimate,
  ArkVtxo,
  ArkServer,
  ArkWalletArgs,
  ArkBolt11Invoice,
  ArkNotificationListener,
  ArkNotificationUnsubscribe,
  ArkMovementEvent,
  ArkWalletProvider
} from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

const ROUND_TX_REQUIRED_CONFIRMATIONS = 0 // Later allow users to change this on the Ark settings
const walletCache = new Map<string, WalletLike>()
const inflightOpens = new Map<string, Promise<void>>()
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

function buildConfig(server: ArkServer, serverAccessToken?: string): Config {
  return Config.create({
    esploraAddress: server.esploraUrl,
    network: appNetworkToBarkNetwork(server.network),
    roundTxRequiredConfirmations: ROUND_TX_REQUIRED_CONFIRMATIONS,
    serverAccessToken: serverAccessToken || undefined,
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

async function createWallet({
  accountId,
  mnemonic,
  server,
  datadir,
  serverAccessToken
}: ArkWalletArgs): Promise<void> {
  const wallet = await Wallet.create(
    mnemonic,
    buildConfig(server, serverAccessToken),
    datadir,
    false
  )
  walletCache.set(accountId, wallet)
}

async function openAndCacheWallet(args: ArkWalletArgs): Promise<void> {
  const wallet = await Wallet.openWithDaemon(
    args.mnemonic,
    buildConfig(args.server, args.serverAccessToken),
    args.datadir,
    undefined
  )
  walletCache.set(args.accountId, wallet)
  await wallet.sync()
}

async function syncWallet(accountId: string): Promise<void> {
  const wallet = getCachedWallet(accountId)
  await wallet.sync()
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
  const wallet = walletCache.get(accountId)
  if (wallet && Wallet.instanceOf(wallet)) {
    wallet.uniffiDestroy()
  }
  walletCache.delete(accountId)
}
function newAddress(accountId: string): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return wallet.newAddress()
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
function mapLightningSend(send: LightningSend): ArkLightningSendResult {
  return {
    amountSats: Number(send.amountSats),
    htlcVtxoCount: send.htlcVtxoCount,
    invoice: send.invoice,
    preimage: send.preimage
  }
}
function sendArkoor(
  accountId: string,
  arkAddress: string,
  amountSats: number
): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return wallet.sendArkoorPayment(arkAddress, BigInt(amountSats))
}

async function payBolt11(
  accountId: string,
  invoice: string,
  amountSats?: number
): Promise<ArkLightningSendResult> {
  const wallet = getCachedWallet(accountId)
  const amount = amountSats === undefined ? undefined : BigInt(amountSats)
  const result = await wallet.payLightningInvoice(invoice, amount)
  return mapLightningSend(result)
}

async function payLightningAddress(
  accountId: string,
  address: string,
  amountSats: number,
  comment?: string
): Promise<ArkLightningSendResult> {
  const wallet = getCachedWallet(accountId)
  const result = await wallet.payLightningAddress(
    address,
    BigInt(amountSats),
    comment
  )
  return mapLightningSend(result)
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

async function listSpendableVtxos(accountId: string): Promise<ArkVtxo[]> {
  const wallet = getCachedWallet(accountId)
  const vtxos = await wallet.spendableVtxos()
  return vtxos.map((vtxo) => ({
    amountSats: Number(vtxo.amountSats),
    expiryHeight: vtxo.expiryHeight,
    id: vtxo.id,
    kind: vtxo.kind,
    state: vtxo.state
  }))
}
const PENDING_RACE_TIMEOUT_MS = 30000
const PENDING_TXID = 'pending'
function waitForMovementCreated(
  label: string,
  accountId: string,
  subsystemKinds: string[]
): Promise<string> {
  const notifications = getOrCreateNotifications(accountId)
  return new Promise<string>((resolve) => {
    const unsubscribe = notifications.subscribe((event) => {
      if (event.tag !== WalletNotification_Tags.MovementCreated) {
        return
      }
      if (!subsystemKinds.includes(event.inner.movement.subsystemKind)) {
        return
      }
      unsubscribe()
      resolve(PENDING_TXID)
    })
  })
}
function rejectAfterTimeout(label: string, ms: number): Promise<string> {
  return new Promise<string>((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`${label}: no movement created within timeout`))
    }, ms)
  })
}
function offboardVtxos(
  accountId: string,
  vtxoIds: string[],
  bitcoinAddress: string
): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return Promise.race([
    waitForMovementCreated('ark-offboard', accountId, ['offboard']),
    wallet.offboardVtxos(vtxoIds, bitcoinAddress),
    rejectAfterTimeout('ark-offboard', PENDING_RACE_TIMEOUT_MS)
  ])
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
function sendOnchain(
  accountId: string,
  bitcoinAddress: string,
  amountSats: number
): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return Promise.race([
    waitForMovementCreated('ark-sendOnchain', accountId, ['send_onchain']),
    wallet.sendOnchain(bitcoinAddress, BigInt(amountSats)),
    rejectAfterTimeout('ark-sendOnchain', PENDING_RACE_TIMEOUT_MS)
  ])
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
  createBolt11Invoice,
  createWallet,
  estimateArkoorFee,
  estimateLightningSendFee,
  estimateOffboardFee,
  estimateSendOnchainFee,
  fetchBalance,
  fetchMovements,
  listSpendableVtxos,
  newAddress,
  offboardVtxos,
  openWallet,
  payBolt11,
  payLightningAddress,
  releaseWallet,
  sendArkoor,
  sendOnchain,
  serverId: 'second',
  subscribeNotifications,
  syncWallet
}
registerArkProvider(barkProvider)

const providers = new Map<ArkServerId, ArkWalletProvider>()

export function registerArkProvider(provider: ArkWalletProvider): void {
  providers.set(provider.serverId, provider)
}

export function getArkProvider(serverId: ArkServerId): ArkWalletProvider {
  const provider = providers.get(serverId)
  if (!provider) {
    throw new Error(`No Ark provider registered for '${serverId}'`)
  }
  return provider
}

export async function createArkWallet(args: ArkWalletArgs): Promise<void> {
  await getArkProvider(args.server.id).createWallet(args)
}

export async function openArkWallet(args: ArkWalletArgs): Promise<void> {
  await getArkProvider(args.server.id).openWallet(args)
}

export async function syncArkWallet(
  serverId: ArkServerId,
  accountId: string
): Promise<void> {
  await getArkProvider(serverId).syncWallet(accountId)
}

export function releaseArkWallet(
  serverId: ArkServerId,
  accountId: string
): void {
  getArkProvider(serverId).releaseWallet(accountId)
}

export function fetchArkBalance(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkBalance> {
  return getArkProvider(serverId).fetchBalance(accountId)
}

export function newArkAddress(
  serverId: ArkServerId,
  accountId: string
): Promise<string> {
  return getArkProvider(serverId).newAddress(accountId)
}

export function createArkBolt11Invoice(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number,
  description?: string
): Promise<ArkBolt11Invoice> {
  return getArkProvider(serverId).createBolt11Invoice(
    accountId,
    amountSats,
    description
  )
}

export function fetchArkMovements(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkMovement[]> {
  return getArkProvider(serverId).fetchMovements(accountId)
}

export function subscribeArkNotifications(
  serverId: ArkServerId,
  accountId: string,
  listener: ArkNotificationListener
): ArkNotificationUnsubscribe {
  return getArkProvider(serverId).subscribeNotifications(accountId, listener)
}

export function sendArkArkoor(
  serverId: ArkServerId,
  accountId: string,
  arkAddress: string,
  amountSats: number
): Promise<string> {
  return getArkProvider(serverId).sendArkoor(accountId, arkAddress, amountSats)
}

export function payArkBolt11(
  serverId: ArkServerId,
  accountId: string,
  invoice: string,
  amountSats?: number
): Promise<ArkLightningSendResult> {
  return getArkProvider(serverId).payBolt11(accountId, invoice, amountSats)
}

export function payArkLightningAddress(
  serverId: ArkServerId,
  accountId: string,
  address: string,
  amountSats: number,
  comment?: string
): Promise<ArkLightningSendResult> {
  return getArkProvider(serverId).payLightningAddress(
    accountId,
    address,
    amountSats,
    comment
  )
}

export function estimateArkArkoorFee(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateArkoorFee(accountId, amountSats)
}

export function estimateArkLightningSendFee(
  serverId: ArkServerId,
  accountId: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateLightningSendFee(
    accountId,
    amountSats
  )
}

export function listArkSpendableVtxos(
  serverId: ArkServerId,
  accountId: string
): Promise<ArkVtxo[]> {
  return getArkProvider(serverId).listSpendableVtxos(accountId)
}

export function offboardArkVtxos(
  serverId: ArkServerId,
  accountId: string,
  vtxoIds: string[],
  bitcoinAddress: string
): Promise<string> {
  return getArkProvider(serverId).offboardVtxos(
    accountId,
    vtxoIds,
    bitcoinAddress
  )
}

export function estimateArkOffboardFee(
  serverId: ArkServerId,
  accountId: string,
  bitcoinAddress: string,
  vtxoIds: string[]
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateOffboardFee(
    accountId,
    bitcoinAddress,
    vtxoIds
  )
}

export function sendArkOnchain(
  serverId: ArkServerId,
  accountId: string,
  bitcoinAddress: string,
  amountSats: number
): Promise<string> {
  return getArkProvider(serverId).sendOnchain(
    accountId,
    bitcoinAddress,
    amountSats
  )
}

export function estimateArkSendOnchainFee(
  serverId: ArkServerId,
  accountId: string,
  bitcoinAddress: string,
  amountSats: number
): Promise<ArkFeeEstimate> {
  return getArkProvider(serverId).estimateSendOnchainFee(
    accountId,
    bitcoinAddress,
    amountSats
  )
}
