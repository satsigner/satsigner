// Ecash types based on @cashu/cashu-ts library
export type EcashMint = {
  url: string
  name?: string
  isConnected: boolean
  keysets: EcashKeyset[]
  balance: number
  lastSync?: string
}

export type EcashKeyset = {
  id: string
  unit: 'sat'
  active: boolean
}

export type EcashProof = {
  id: string
  amount: number
  secret: string
  C: string
}

export type EcashToken = {
  mint: string
  proofs: EcashProof[]
  unit?: 'sat'
  memo?: string
}

export type MintQuote = {
  quote: string
  request: string
  expiry: number
  paid: boolean
}

export type MeltQuote = {
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

export type MeltQuoteState = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'

export type EcashConnectionStatus = {
  isConnected: boolean
  isConnecting: boolean
  lastError?: string
  lastSync?: string
}

export type EcashSendResult = {
  token: string
  keep: EcashProof[]
  send: EcashProof[]
}

export type EcashReceiveResult = {
  proofs: EcashProof[]
  totalAmount: number
}

export type EcashMeltResult = {
  paid: boolean
  preimage?: string
  change?: EcashProof[]
}

export type EcashMintResult = {
  proofs: EcashProof[]
  totalAmount: number
}

export type EcashTransaction = {
  id: string
  type: 'send' | 'receive' | 'mint' | 'melt'
  amount: number
  memo?: string
  label?: string // User-friendly label for the transaction
  mintUrl: string
  timestamp: string
  status?: 'pending' | 'completed' | 'failed' | 'expired'
  token?: string // For send transactions
  tokenStatus?: 'unspent' | 'spent' | 'invalid' | 'pending' // Token status for send transactions
  invoice?: string // For melt transactions
  quoteId?: string // For mint/melt transactions
  expiry?: number // Expiration timestamp for mint/melt transactions
}
