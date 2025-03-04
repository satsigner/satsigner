import { type Transaction } from './Transaction'
import { type Utxo } from './Utxo'

export type PolicyType = 'singlesig' | 'multisig' | 'watchonly'

export type MnemonicCount = 12 | 15 | 18 | 21 | 24

export type ScriptVersionType = 'P2PKH' | 'P2SH-P2WPKH' | 'P2WPKH' | 'P2TR'

export type CreationType =
  | 'generateSeed'
  | 'importSeed'
  | 'importDescriptor'
  | 'importExtendedPub'
  | 'importAddress'

export type Key = {
  // Below deprecated
  keyName?: string // name
  createdAt?: Date
  mnemonicWordCount?: MnemonicCount
  mnemonic?: string
  passphrase?: string
  scriptVersion?: ScriptVersionType
  externalDescriptor?: string
  internalDescriptor?: string
  fingerprint?: string
  derivationPath?: string
  publicKey?: string
  creationType?: CreationType
}

export type Account = {
  id: string
  name: string
  policyType: PolicyType
  keys?: Key[]
  keyCount?: number
  keysRequired?: number
  // Below deprecated
  watchOnly?: 'public-key' | 'address' // TODO: To remove
  createdAt: Date
  /** Seed phrase with seed words separated with space */
  externalDescriptor?: string
  internalDescriptor?: string
  fingerprint?: string
  derivationPath?: string
  transactions: Transaction[]
  utxos: Utxo[]
  summary: {
    balance: number
    numberOfAddresses: number
    numberOfTransactions: number
    numberOfUtxos: number
    satsInMempool: number
  }
  participantsCount?: number
  requiredParticipantsCount?: number
}
