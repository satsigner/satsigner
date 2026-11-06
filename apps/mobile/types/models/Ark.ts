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
  needsRefreshSats?: number
  pendingArkoorSendSats?: number
  pendingOffboardSats?: number
}

export type ArkMovementStatus = 'pending' | 'successful' | 'failed' | 'canceled'

export type ArkMovementKind =
  | 'board'
  | 'offboard'
  | 'receive'
  | 'refresh'
  | 'send'

export type ArkLightningSendResult = {
  invoice: string
  amountSats: number
  htlcVtxoCount: number
  preimage?: string
}

// Outcome of a lightning send started without waiting. `unknown` means the
// wallet holds no record of it: it never started, or it failed and its HTLCs
// were revoked, so the funds are back in the Ark balance.
export type ArkLightningSendState =
  | { status: 'unknown' }
  | { status: 'inProgress' }
  | { status: 'paid'; preimage: string }

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

// Destination for an externally funded board (e.g. a payjoin receive). The
// funding script commits to keypairIndex and expiryHeight, so both must be
// passed back unchanged to boardPsbt once the funding PSBT is available.
export type ArkBoardFundingInfo = {
  address: string
  expiryHeight: number
  keypairIndex: number
}

export type ArkServerInfo = {
  minBoardAmountSats: number
  requiredBoardConfirmations: number
  vtxoLifetime: number
  vtxoExitDelta: number
  maxVtxoExitDepth: number
}

// A board funded by a Satsigner on-chain account in a single transaction. The
// funding output only becomes a unilaterally exitable VTXO once the server
// cosigns the exact funding txid, so the intent travels with the draft until
// broadcast.
export type ArkBoardIntent = ArkBoardFundingInfo & {
  arkAccountId: string
  serverId: ArkServerId
  cosigned?: ArkPendingBoard
}

export type ArkLightningReceiveState =
  | 'awaiting-payment'
  | 'htlcs-ready'
  | 'preimage-revealed'
  | 'delivering'
  | 'settled'

export type ArkLightningReceive = {
  paymentHash: string
  invoice: string
  amountSats?: number
  state: ArkLightningReceiveState | string
  settled: boolean
}

export type ArkOnchainUtxo = {
  outpoint: string
  amountSats: number
  confirmed: boolean
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

export type ArkExitStatus =
  | 'starting'
  | 'processing'
  | 'awaitingDelta'
  | 'claimable'
  | 'claimInProgress'
  | 'claimed'
  | 'alreadySpent'
  | 'swept'
  | 'canceled'

export type ArkExit = {
  vtxoId: string
  // Unknown for finished exits whose VTXO the wallet no longer stores.
  amountSats?: number
  status: ArkExitStatus
  tipHeight: number
  confirmedTxCount?: number
  totalTxCount?: number
  // An exit transaction is ready for its fee-paying child, which the wallet
  // can only broadcast once its on-chain wallet holds enough to pay for it.
  awaitingCpfpBroadcast?: boolean
  claimableAtHeight?: number
  claimTxid?: string
}

export type ArkExitClaimDraft = {
  psbtBase64: string
  feeSats: number
  vtxoIds: string[]
  skippedVtxoIds: string[]
}

export type ArkExitClaimBroadcastStatus =
  | 'broadcasting'
  | 'broadcast'
  | 'failed'

// A signed claim kept until the wallet sees it spend the exits. Only this exact
// transaction may be (re)broadcast meanwhile, so a crash can never lead to a
// second, different claim of the same exits.
export type ArkExitClaimRecord = {
  txid: string
  txHex: string
  arkAccountId: string
  vtxoIds: string[]
  amountSats: number
  feeSats: number
  destinationAccountId: string
  broadcastStatus: ArkExitClaimBroadcastStatus
  createdAt: string
}

export type ArkEmergencyExitFee = {
  exitBroadcastFeeSats: number
  claimFeeSats: number
  totalFeeSats: number
  feeRateSatPerVb: number
}

export type ArkOnchainFeeRates = {
  slowSatPerVb: number
  regularSatPerVb: number
  fastSatPerVb: number
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
  paymentHash: string
}

type ArkMovementEventType = 'created' | 'updated'

export type ArkMovementEvent = {
  type: ArkMovementEventType
  accountId: string
  movementId: number
  status: string
  subsystemKind: string
  subsystemName: string
  effectiveBalanceSats: number
  paymentHash?: string
}

export type ArkReceiveOverlayEvent = {
  accountId: string
  accountName: string
  movementId: number
  amountSats: number
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
  estimateLightningReceiveFee: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkFeeEstimate>
  listSpendableVtxos: (accountId: string) => Promise<ArkVtxo[]>
  listAllVtxos: (accountId: string) => Promise<ArkVtxo[]>
  refreshVtxos: (accountId: string, vtxoIds: string[]) => Promise<string>
  startExit: (accountId: string, vtxoIds?: string[]) => Promise<void>
  listExits: (accountId: string) => Promise<ArkExit[]>
  syncExits: (accountId: string) => Promise<void>
  estimateEmergencyExitFee: (
    accountId: string,
    vtxoIds: string[]
  ) => Promise<ArkEmergencyExitFee>
  buildExitClaim: (
    accountId: string,
    vtxoIds: string[],
    bitcoinAddress: string,
    feeRateSatPerVb: number
  ) => Promise<ArkExitClaimDraft>
  signExitClaim: (accountId: string, psbtBase64: string) => Promise<string>
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
  fetchOnchainFeeRate: (accountId: string) => Promise<number>
  fetchOnchainFeeRates: (accountId: string) => Promise<ArkOnchainFeeRates>
  newOnchainAddress: (accountId: string) => Promise<string>
  board: (accountId: string, amountSats?: number) => Promise<ArkPendingBoard>
  boardFundingAddress: (accountId: string) => Promise<ArkBoardFundingInfo>
  boardPsbt: (
    accountId: string,
    psbtBase64: string,
    keypairIndex: number,
    expiryHeight: number
  ) => Promise<ArkPendingBoard>
  estimateBoardFee: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkFeeEstimate>
  listPendingBoards: (accountId: string) => Promise<ArkPendingBoard[]>
  fetchServerInfo: (accountId: string) => Promise<ArkServerInfo | null>
  fetchTipHeight: (accountId: string) => Promise<number>
  fetchVtxoEncoded: (accountId: string, vtxoId: string) => Promise<string>
  fetchVtxoState: (accountId: string, vtxoId: string) => Promise<string>
  checkLightningSend: (
    accountId: string,
    paymentHash: string
  ) => Promise<ArkLightningSendState>
  fetchLightningReceive: (
    accountId: string,
    paymentHash: string
  ) => Promise<ArkLightningReceive>
  claimLightningReceive: (
    accountId: string,
    paymentHash: string
  ) => Promise<ArkLightningReceive>
  listOnchainUtxos: (accountId: string) => Promise<ArkOnchainUtxo[]>
  sendFromOnchain: (
    accountId: string,
    bitcoinAddress: string,
    amountSats: number,
    feeRateSatPerVb: number
  ) => Promise<string>
}

export type ArkFeeRequest =
  | { kind: 'arkoor' | 'lightning' | 'board'; amountSats: number }
  | { kind: 'onchain'; address: string; amountSats: number }
  | { kind: 'offboard'; address: string; vtxoIds: string[] }
  | { kind: 'refresh'; vtxoIds: string[] }

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
