export type SwapStatus =
  | 'pending'
  | 'transaction.mempool'
  | 'transaction.claimed'
  | 'invoice.set'
  | 'error'
  | 'expired'

export type SwapDirection = 'btc-to-lightning' | 'lightning-to-btc'

export type SwapTree = {
  claimLeaf: { version: number; output: string }
  refundLeaf: { version: number; output: string }
}

export type Swap = {
  id: string
  direction: SwapDirection
  status: SwapStatus
  amountSats: number
  createdAt: string
  sourceAccountId: string
  destinationAccountId: string
  // submarine swap fields (btc-to-lightning)
  address?: string
  expectedAmount?: number
  // reverse swap fields (lightning-to-btc)
  invoice?: string
  preimage?: string
  claimPrivKey?: string
  claimPublicKey?: string
  txid?: string
  // taproot claim fields
  swapTree?: SwapTree
  refundPublicKey?: string
  lockupAddress?: string
}
