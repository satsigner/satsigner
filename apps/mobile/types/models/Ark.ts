import { type Network } from '@/types/settings/blockchain'

export type ArkServerId = 'second'

export type ArkServer = {
  id: ArkServerId
  name: string
  network: Network
  arkUrl: string
  esploraUrl: string
}

export type ArkAccount = {
  id: string
  name: string
  network: Network
  serverId: ArkServerId
  bitcoinAccountId: string | null
  createdAt: string
}

export type ArkBalance = {
  spendableSats: number
  pendingInRoundSats: number
  pendingExitSats: number
  pendingLightningSendSats: number
  claimableLightningReceiveSats: number
  pendingBoardSats: number
}
