import { type Network } from '../settings/blockchain'
import { type Address } from './Address'
import { type Transaction } from './Transaction'
import { type Utxo } from './Utxo'

export type PolicyType = 'singlesig' | 'multisig' | 'watchonly'

export type MnemonicCount = 12 | 15 | 18 | 21 | 24

export type ScriptVersionType = 'P2PKH' | 'P2SH-P2WPKH' | 'P2WPKH' | 'P2TR'

export type SyncStatus = 'unsynced' | 'synced' | 'syncing' | 'error' | 'timeout'

// TODO: merge SyncProgress in SyncStatus ?
export type SyncProgress = {
  totalTasks: number
  tasksDone: number
}

export type CreationType =
  | 'generateMnemonic'
  | 'importMnemonic'
  | 'importDescriptor'
  | 'importExtendedPub'
  | 'importAddress'

export type Secret = {
  /** Mnemonic words separated with a space */
  mnemonic?: string
  passphrase?: string
  /** Only for sigle/multisig import descriptor and watch-only descriptor/extended key */
  externalDescriptor?: string
  /** Only for sigle/multisig import descriptor and watch-only descriptor/extended key */
  internalDescriptor?: string
  /** Only for watch-only */
  extendedPublicKey?: string
}

export type Key = {
  /** Key position for multisig. Set to 0 if singlesig */
  index: number
  name?: string
  creationType: CreationType
  mnemonicWordCount?: MnemonicCount
  /** Sensitive information that can be encrypted with PIN */
  secret: Secret | string
  /** Initialization vector for AES encryption */
  iv: string
  fingerprint?: string
  scriptVersion?: ScriptVersionType
  derivationPath?: string
}

export type DM = {
  id: string
  author: string
  created_at: number
  description: string
  event: string
  label: number
  content: {
    description: string
    created_at: number
    pubkey?: string
  }
}

export type Account = {
  id: string
  name: string
  network: Network
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
  transactions: Transaction[]
  utxos: Utxo[]
  addresses: Address[]
  createdAt: Date
  isSyncing?: boolean
  lastSyncedAt?: Date
  syncStatus: SyncStatus
  syncProgress?: SyncProgress
  nostr: {
    commonNpub: string
    commonNsec: string
    relays: string[]
    autoSync: boolean
    lastBackupFingerprint?: string
    deviceNpub?: string
    deviceNsec?: string
    trustedMemberDevices: string[]
    dms: DM[]
    lastUpdated: Date
    syncStart: Date
  }
}

export type NostrAccount = {
  commonNpub: string
  commonNsec: string
  relays: string[]
  autoSync: boolean
  lastBackupFingerprint?: string
  deviceNpub?: string
  deviceNsec?: string
  dms?: DM[]
  members?: NostrMember[]
  syncStart: Date
  lastProtocolEOSE?: number
  lastDataExchangeEOSE?: number
  lastUpdated: Date
  trustedMemberDevices: string[]
}

export type NostrMember = {
  npub: string
  color?: string
}
