import { type Address } from './Address'
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

export interface Secret {
  mnemonic: string
  xpriv: string
}

export interface Key {
  secret: string | Uint8Array
  iv: string
}

export interface Account {
  id: string
  name: string
  policyType: PolicyType
  /** Account keys. Default: [] */
  keys: Key[]
  /** Total account keys. Default: 1 */
  keyCount: number
  /** Keys required to sign. Default: 1 */
  keysRequired: number
  summary: {
    balance: number
    numberOfAddresses: number
    numberOfTransactions: number
    numberOfUtxos: number
    satsInMempool: number
  }
  transactions: { id: string; label?: string }[]
  utxos: { txid: string; vout: number; label?: string }[]
  addresses: { address: string; label?: string }[]
  createdAt: Date
  isSyncing?: boolean
  nostrPubkey?: string
  nostrRelays?: string[]
  nostrLabelsAutoSync?: boolean
  nostrPassphrase?: string
}
