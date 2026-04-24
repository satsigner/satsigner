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

export type ArkLightningSendResult = {
  invoice: string
  amountSats: number
  htlcVtxoCount: number
  preimage?: string
}

export type ArkSendKind = 'arkoor' | 'bolt11' | 'lnaddress' | 'lnurl'

export type ArkSendInput =
  | { kind: 'arkoor'; address: string; amountSats: number }
  | { kind: 'bolt11'; invoice: string; amountSats?: number }
  | {
      kind: 'lnaddress'
      address: string
      amountSats: number
      comment?: string
    }
  | { kind: 'lnurl'; lnurl: string; amountSats: number; comment?: string }

export type ArkSendOutcome = {
  kind: ArkSendKind
  amountSats: number
  txid?: string
  invoice?: string
  preimage?: string
}

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
