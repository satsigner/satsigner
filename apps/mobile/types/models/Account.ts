import { type Transaction } from './Transaction'
import { type Utxo } from './Utxo'

export type SeedWordCountType = 12 | 15 | 18 | 21 | 24
export type ScriptVersionType = 'P2PKH' | 'P2SH-P2WPKH' | 'P2WPKH' | 'P2TR'
export type AccountCreationType =
  | 'generate'
  | 'import'
  | 'stateless'
  | 'wif'
  | null
  | undefined
export type ParticipantCrationType =
  | 'generate'
  | 'importseed'
  | 'importdescriptor'
  | null
  | undefined
export type MultisigParticipant = {
  keyName?: string
  createdAt?: Date
  seedWordCount?: SeedWordCountType
  seedWords?: string
  passphrase?: string
  scriptVersion?: ScriptVersionType
  externalDescriptor?: string
  internalDescriptor?: string
  fingerprint?: string
  derivationPath?: string
  publicKey?: string
  creationType?: ParticipantCrationType
}

export type Account = {
  name: string
  createdAt: Date
  accountCreationType: AccountCreationType
  watchOnly?: 'public-key' | 'address'
  seedWordCount?: SeedWordCountType
  /** Seed phrase with seed words separated with space */
  seedWords?: string
  passphrase?: string
  scriptVersion?: ScriptVersionType
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
  policyType?: 'single' | 'multi'
  participants?: MultisigParticipant[]
  participantsCount?: number
  requiredParticipantsCount?: number
}
