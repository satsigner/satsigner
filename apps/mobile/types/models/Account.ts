import { Transaction } from './Transaction'
import { Utxo } from './Utxo'

export type Account = {
  name: string
  accountCreationType:
    | 'generate'
    | 'import'
    | 'stateless'
    | 'wif'
    | null
    | undefined
  seedWordCount?: 12 | 15 | 18 | 21 | 24
  seedWords: string
  passphrase?: string
  scriptVersion: 'P2PKH' | 'P2SH-P2WPKH' | 'P2WPKH' | 'P2TR'
  externalDescriptor: string
  internalDescriptor: string
  fingerprint?: string
  derivationPath: string
  usedIndexes: number[]
  currentIndex: number
  transactions: Transaction[]
  utxos: Utxo[]
  summary: {
    balance: number
    numberOfAddresses: number
    numberOfTransactions: number
    numberOfUtxos: number
    satsInMempool: number
  }
}
