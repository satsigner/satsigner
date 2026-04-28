import type {
  ArkBalance,
  ArkFeeEstimate,
  ArkLightningSendResult,
  ArkMovement,
  ArkServer,
  ArkServerId,
  ArkVtxo
} from '@/types/models/Ark'

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
  syncWallet: (accountId: string) => Promise<void>
  releaseWallet: (accountId: string) => void
  fetchBalance: (accountId: string) => Promise<ArkBalance>
  newAddress: (accountId: string) => Promise<string>
  createBolt11Invoice: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkBolt11Invoice>
  fetchMovements: (accountId: string) => Promise<ArkMovement[]>
  subscribeNotifications: (
    accountId: string,
    listener: ArkNotificationListener
  ) => ArkNotificationUnsubscribe
  sendArkoor: (
    accountId: string,
    arkAddress: string,
    amountSats: number
  ) => Promise<string>
  payBolt11: (
    accountId: string,
    invoice: string,
    amountSats?: number
  ) => Promise<ArkLightningSendResult>
  payLightningAddress: (
    accountId: string,
    address: string,
    amountSats: number,
    comment?: string
  ) => Promise<ArkLightningSendResult>
  estimateArkoorFee: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkFeeEstimate>
  estimateLightningSendFee: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkFeeEstimate>
  listSpendableVtxos: (accountId: string) => Promise<ArkVtxo[]>
  offboardVtxos: (
    accountId: string,
    vtxoIds: string[],
    bitcoinAddress: string
  ) => Promise<string>
  estimateOffboardFee: (
    accountId: string,
    bitcoinAddress: string,
    vtxoIds: string[]
  ) => Promise<ArkFeeEstimate>
  sendOnchain: (
    accountId: string,
    bitcoinAddress: string,
    amountSats: number
  ) => Promise<string>
  estimateSendOnchainFee: (
    accountId: string,
    bitcoinAddress: string,
    amountSats: number
  ) => Promise<ArkFeeEstimate>
}
