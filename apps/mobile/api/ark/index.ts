import type { ArkBalance, ArkMovement, ArkServerId } from '@/types/models/Ark'

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
