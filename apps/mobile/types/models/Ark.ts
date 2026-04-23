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

export type ArkMovementStatus = 'pending' | 'successful' | 'failed' | 'canceled'

export type ArkMovementKind = 'receive' | 'send' | 'refresh'

export type ArkMovement = {
  id: number
  status: ArkMovementStatus | string
  subsystemName: string
  subsystemKind: string
  metadataJson: string
  intendedBalanceSats: number
  effectiveBalanceSats: number
  offchainFeeSats: number
  sentToAddresses: string[]
  receivedOnAddresses: string[]
  inputVtxoIds: string[]
  outputVtxoIds: string[]
  exitedVtxoIds: string[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
}
