import {
  Config,
  type LightningSend,
  type Movement,
  Network as BarkNetwork,
  Wallet,
  WalletNotification_Tags,
  WalletNotifications,
  type WalletLike,
  type WalletNotification
} from '@secondts/bark-react-native'

import type {
  ArkBalance,
  ArkLightningSendResult,
  ArkMovement,
  ArkServer
} from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

import type {
  ArkBolt11Invoice,
  ArkMovementEvent,
  ArkNotificationListener,
  ArkNotificationUnsubscribe,
  ArkWalletArgs,
  ArkWalletProvider
} from '../provider'
import { registerArkProvider } from '../registry'

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
  const wallet = await Wallet.open(
    args.mnemonic,
    buildConfig(args.server, args.serverAccessToken),
    args.datadir
  )
  walletCache.set(args.accountId, wallet)
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
  amountSats: number
): Promise<ArkBolt11Invoice> {
  const wallet = getCachedWallet(accountId)
  const invoice = await wallet.bolt11Invoice(BigInt(amountSats))
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
  fetchBalance,
  fetchMovements,
  newAddress,
  openWallet,
  payBolt11,
  payLightningAddress,
  releaseWallet,
  sendArkoor,
  serverId: 'second',
  subscribeNotifications
}

registerArkProvider(barkProvider)
