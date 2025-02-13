import { Transaction } from './Transaction'
import { Utxo } from './Utxo'

export type Account = {
  name: string
  createdAt: Date
  accountCreationType:
    | 'generate'
    | 'import'
    | 'stateless'
    | 'wif'
    | null
    | undefined
  watchOnly?: 'public-key' | 'address'
  seedWordCount?: 12 | 15 | 18 | 21 | 24
  /** Seed phrase with seed words separated with space */
  seedWords?: string
  passphrase?: string
  scriptVersion?: 'P2PKH' | 'P2SH-P2WPKH' | 'P2WPKH' | 'P2TR'
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
  participants?: string[]
  participantsCount?: number
  requiredParticipantsCount?: number
  externalDescriptors?: string[]
  internalDescriptors?: string[]
  fingerprints?: string[]
  derivationPaths?: string[]
}
