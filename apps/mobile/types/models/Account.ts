import { type Transaction } from './Transaction'
import { type Utxo } from './Utxo'

export type PolicyType = 'singlesig' | 'multisig' | 'watchonly'

export type MnemonicCount = 12 | 15 | 18 | 21 | 24

export type ScriptVersionType = 'P2PKH' | 'P2SH-P2WPKH' | 'P2WPKH' | 'P2TR'

export type CreationType =
  | 'generateMnemonic'
  | 'importMnemonic'
  | 'importDescriptor'
  | 'importExtendedPub'
  | 'importAddress'

export type Key = {
  name?: string
  /** Key position for multisig. Set to 0 if singlesig */
  index?: number
  createdAt?: Date
  // Below deprecated
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
  /** Account keys. Default: [] */
  keys: Key[]
  /** Total account keys. Default: 1 */
  keyCount: number
  /** Keys required to sign. Default: 1 */
  keysRequired: number
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
