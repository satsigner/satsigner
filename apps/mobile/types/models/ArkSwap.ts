export type ArkSwapEndpointKind = 'ark' | 'lightning' | 'onchain'

export type ArkSwapRoute =
  | 'arkToLightning'
  | 'arkToOnchain'
  | 'lightningToArk'
  | 'lightningToOnchain'
  | 'onchainToArk'
  | 'onchainToLightning'

type ArkSwapJobBase = {
  id: string
  arkAccountId: string
  amountSats: number
  createdAt: number
  updatedAt: number
  error?: string
}

// Boards from a Satsigner wallet, then pays a lightning invoice from Ark once
// the board is spendable. The invoice may be supplied up front or later.
export type ArkOnchainToLightningStatus =
  | 'awaitingFunding'
  | 'boarding'
  | 'awaitingInvoice'
  | 'paying'
  | 'completed'
  | 'failed'

export type ArkOnchainToLightningJob = ArkSwapJobBase & {
  kind: 'onchainToLightning'
  status: ArkOnchainToLightningStatus
  sourceAccountId: string
  boardAddress: string
  invoice?: string
  invoiceExpiresAt?: number
  paymentHash?: string
  // The board left Ark, so nothing is there for this swap to pay from.
  boardExited?: boolean
}

// Receives a lightning payment into Ark, then sends it on-chain to a fresh
// address of a Satsigner wallet.
export type ArkLightningToOnchainStatus =
  | 'awaitingPayment'
  | 'sending'
  | 'completed'
  | 'failed'

export type ArkLightningToOnchainJob = ArkSwapJobBase & {
  kind: 'lightningToOnchain'
  status: ArkLightningToOnchainStatus
  destinationAccountId: string
  invoice: string
  paymentHash: string
  invoiceExpiresAt: number
  receivedSats?: number
  destinationAddress?: string
  payoutSats?: number
  feeSats?: number
  txid?: string
  // When the payout send last started or threw. Unlike updatedAt, a runner
  // error does not move it, so the reconcile grace period still runs out.
  sendAttemptedAt?: number
}

export type ArkSwapJob = ArkOnchainToLightningJob | ArkLightningToOnchainJob

// What the user asked for. Quotes and starts share it, so a quoted swap is
// started with exactly the fields it was quoted with.
export type ArkSwapRequest =
  | { route: 'arkToLightning'; arkAccountId: string; invoice: string }
  | {
      route: 'arkToOnchain' | 'lightningToOnchain'
      arkAccountId: string
      destinationAccountId: string
      amountSats: number
    }
  | { route: 'lightningToArk'; arkAccountId: string; amountSats: number }
  | {
      route: 'onchainToArk'
      arkAccountId: string
      sourceAccountId: string
      amountSats: number
    }
  | {
      route: 'onchainToLightning'
      arkAccountId: string
      sourceAccountId: string
      amountSats: number
      invoice?: string
    }

export type ArkSwapStartResult =
  | { route: 'arkToLightning'; amountSats: number }
  | { route: 'arkToOnchain'; amountSats: number; destinationName: string }
  | { route: 'lightningToArk'; invoice: string; amountSats: number }
  | { route: 'lightningToOnchain'; jobId: string }
  | { route: 'onchainToArk'; sourceAccountId: string }
  | {
      route: 'onchainToLightning'
      jobId: string
      sourceAccountId: string
      invoiceHeld: boolean
    }

// Ark server fees only. Boards also pay an on-chain miner fee, which the
// transaction builder shows once the funding transaction is drafted.
export type ArkSwapQuote = {
  sendSats: number
  feeSats: number
  receiveSats: number
}
