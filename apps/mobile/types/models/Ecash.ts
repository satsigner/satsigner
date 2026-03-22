// Ecash types based on @cashu/cashu-ts library
export interface EcashMint {
  url: string
  name?: string
  isConnected: boolean
  keysets: EcashKeyset[]
  balance: number
  lastSync?: string
}

export interface EcashKeyset {
  id: string
  unit: 'sat'
  active: boolean
}

export interface EcashProof {
  id: string
  amount: number
  secret: string
  C: string
}

export interface EcashToken {
  mint: string
  proofs: EcashProof[]
  unit?: 'sat'
  memo?: string
}

export interface MintQuote {
  quote: string
  request: string
  expiry: number
  paid: boolean
}

export interface MeltQuote {
  quote: string
  amount: number
  fee_reserve: number
  paid: boolean
  expiry: number
}

export type MintQuoteState =
  | 'PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'UNPAID'
  | 'ISSUED'

export interface EcashConnectionStatus {
  isConnected: boolean
  isConnecting: boolean
  lastSync?: string
}

export interface EcashSendResult {
  token: string
  keep: EcashProof[]
  send: EcashProof[]
}

export interface EcashReceiveResult {
  proofs: EcashProof[]
  totalAmount: number
  memo?: string
}

export interface EcashMeltResult {
  paid: boolean
  preimage?: string
  change?: EcashProof[]
}

export interface EcashMintResult {
  proofs: EcashProof[]
  totalAmount: number
}

export interface EcashTransaction {
  id: string
  type: 'send' | 'receive' | 'mint' | 'melt'
  amount: number
  memo?: string
  label?: string // User-friendly label for the transaction
  mintUrl: string
  timestamp: string
  status?: 'pending' | 'completed' | 'failed' | 'expired' | 'settled'
  token?: string // For send transactions
  tokenStatus?: 'unspent' | 'spent' | 'invalid' | 'pending' // Token status for send transactions
  invoice?: string // For melt transactions
  quoteId?: string // For mint/melt transactions
  expiry?: number // Expiration timestamp for mint/melt transactions
}
