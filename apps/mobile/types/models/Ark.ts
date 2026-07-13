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

export type ArkAccountStats = {
  numberOfTransactions: number
  numberOfAddresses: number
  numberOfVtxos: number
  numberOfRefreshes: number
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

export type ArkFeeEstimate = {
  grossAmountSats: number
  feeSats: number
  netAmountSats: number
  vtxoIdsSpent: string[]
}

export type ArkOnchainBalance = {
  confirmedSats: number
  pendingSats: number
  totalSats: number
}

export type ArkPendingBoard = {
  vtxoId: string
  amountSats: number
  txid: string
}

export type ArkServerInfo = {
  minBoardAmountSats: number
  requiredBoardConfirmations: number
}

export type ArkVtxo = {
  id: string
  amountSats: number
  expiryHeight: number
  kind: string
  state: string
  spendable: boolean
  exitDepth: number
}

export type ArkDerivedAddress = {
  index: number
  address: string
}

export type ArkAddress = {
  index: number
  address: string
  used: boolean
  receivedSats: number
  receiveCount: number
}

export type ArkSendKind =
  | 'arkoor'
  | 'bolt11'
  | 'lnaddress'
  | 'lnurl'
  | 'onchain'

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
  | { kind: 'onchain'; address: string; amountSats: number }

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
export type ArkWalletArgs = {
  accountId: string
  mnemonic: string
  server: ArkServer
  datadir: string
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
    amountSats: number,
    description?: string
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
  ) => Promise<void>
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
  listAllVtxos: (accountId: string) => Promise<ArkVtxo[]>
  refreshVtxos: (accountId: string, vtxoIds: string[]) => Promise<string>
  startExit: (accountId: string, vtxoIds?: string[]) => Promise<void>
  estimateRefreshFee: (
    accountId: string,
    vtxoIds: string[]
  ) => Promise<ArkFeeEstimate>
  deriveAddresses: (
    accountId: string,
    startIndex: number,
    count: number
  ) => Promise<ArkDerivedAddress[]>
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
  fetchOnchainBalance: (accountId: string) => Promise<ArkOnchainBalance>
  newOnchainAddress: (accountId: string) => Promise<string>
  board: (accountId: string, amountSats?: number) => Promise<ArkPendingBoard>
  estimateBoardFee: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkFeeEstimate>
  listPendingBoards: (accountId: string) => Promise<ArkPendingBoard[]>
  fetchServerInfo: (accountId: string) => Promise<ArkServerInfo | null>
}

export type ArkSendFeeKind = 'arkoor' | 'lightning' | 'onchain'

export type ArkOffboardInput = {
  vtxoIds: string[]
  bitcoinAddress: string
}

export type ArkDestinationDraft =
  | {
      kind: 'arkoor'
      address: string
    }
  | {
      kind: 'bolt11'
      invoice: string
      amountSatsFromInvoice?: number
      description?: string
    }
  | {
      kind: 'lnaddress'
      address: string
    }
  | {
      kind: 'lnurl'
      lnurl: string
    }
  | {
      kind: 'onchain'
      address: string
    }

export type ArkDestinationParseResult =
  | { ok: true; draft: ArkDestinationDraft }
  | { ok: false; reason: 'unsupported' | 'invalid' }
