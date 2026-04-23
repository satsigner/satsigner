import type { ArkBalance, ArkServer, ArkServerId } from '@/types/models/Ark'

export type ArkWalletArgs = {
  accountId: string
  mnemonic: string
  server: ArkServer
  datadir: string
  /** Optional bearer for private Ark servers — forwarded as `ark-access-token`. */
  serverAccessToken?: string
}

export type ArkBolt11Invoice = {
  invoice: string
  amountSats: number
}

export type ArkMovementEventType = 'created' | 'updated'

export type ArkMovementEvent = {
  type: ArkMovementEventType
  accountId: string
  movementId: number
  status: string
  effectiveBalanceSats: number
}

export type ArkNotificationListener = (event: ArkMovementEvent) => void
export type ArkNotificationUnsubscribe = () => void

export interface ArkWalletProvider {
  readonly serverId: ArkServerId
  createWallet: (args: ArkWalletArgs) => Promise<void>
  openWallet: (args: ArkWalletArgs) => Promise<void>
  releaseWallet: (accountId: string) => void
  fetchBalance: (accountId: string) => Promise<ArkBalance>
  newAddress: (accountId: string) => Promise<string>
  createBolt11Invoice: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkBolt11Invoice>
  subscribeNotifications: (
    accountId: string,
    listener: ArkNotificationListener
  ) => ArkNotificationUnsubscribe
}
