import type {
  ArkBalance,
  ArkFeeEstimate,
  ArkLightningSendResult,
  ArkMovement,
  ArkServerId,
  ArkVtxo
} from '@/types/models/Ark'

import type {
  ArkBolt11Invoice,
  ArkNotificationListener,
  ArkNotificationUnsubscribe,
  ArkWalletArgs
} from './provider'
import { getArkProvider } from './registry'
import './providers/bark'

export type {
  ArkBolt11Invoice,
  ArkMovementEvent,
  ArkMovementEventType,
  ArkNotificationListener,
  ArkNotificationUnsubscribe,
  ArkWalletArgs
} from './provider'

export async function createArkWallet(args: ArkWalletArgs): Promise<void> {
  await getArkProvider(args.server.id).createWallet(args)
}

export async function openArkWallet(args: ArkWalletArgs): Promise<void> {
  await getArkProvider(args.server.id).openWallet(args)
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
  amountSats: number
): Promise<ArkBolt11Invoice> {
  return getArkProvider(serverId).createBolt11Invoice(accountId, amountSats)
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
