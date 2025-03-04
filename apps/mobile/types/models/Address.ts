import type { Network } from '../settings/blockchain'
import type { ScriptVersionType } from './Account'

export type Address = {
  address: string
  label: string
  utxos: string[]
  transactions: string[]
  derivationPath?: string
  index?: number
  keychain?: 'internal' | 'external'
  network?: Network
  scriptVersion?: ScriptVersionType
  summary: {
    utxos: number
    transactions: number
    balance: number
    satsInMempool: number
  }
}
