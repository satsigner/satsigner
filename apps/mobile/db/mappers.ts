import {
  type Account,
  type Key,
  type KeyMeta,
  type SyncProgress
} from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type NostrAccount, type NostrDM } from '@/types/models/Nostr'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Label } from '@/utils/bip329'

type AccountRow = {
  id: string
  name: string
  network: string
  policy_type: string
  keys: string
  key_count: number
  keys_required: number
  balance: number
  num_addresses: number
  num_transactions: number
  num_utxos: number
  sats_in_mempool: number
  created_at: string
  last_synced_at: string | null
  sync_status: string
  sync_progress_total: number | null
  sync_progress_done: number | null
  nostr_auto_sync: number
  nostr_common_npub: string
  nostr_common_nsec: string
  nostr_device_npub: string | null
  nostr_device_nsec: string | null
  nostr_device_display_name: string | null
  nostr_device_picture: string | null
  nostr_last_backup_fingerprint: string | null
  nostr_last_updated: string | null
  nostr_sync_start: string | null
  nostr_npub_aliases: string
  nostr_npub_profiles: string
}

type TransactionRow = {
  id: string
  account_id: string
  type: string
  sent: number
  received: number
  timestamp: string | null
  block_height: number | null
  address: string | null
  label: string | null
  fee: number | null
  size: number | null
  vsize: number | null
  weight: number | null
  version: number | null
  lock_time: number | null
  lock_time_enabled: number
  raw: string | null
  prices: string
}

type TxInputRow = {
  input_index: number
  prev_txid: string
  prev_vout: number
  sequence: number
  script_sig: string | null
  witness: string | null
  value: number | null
  label: string | null
}

type TxOutputRow = {
  output_index: number
  value: number
  address: string
  script: string | null
  label: string | null
}

type UtxoRow = {
  txid: string
  vout: number
  account_id: string
  value: number
  timestamp: string | null
  label: string | null
  address_to: string | null
  keychain: string
  script: string | null
}

type AddressRow = {
  address: string
  account_id: string
  label: string | null
  derivation_path: string | null
  addr_index: number | null
  keychain: string | null
  network: string | null
  script_version: string | null
  utxo_count: number
  tx_count: number
  balance: number
  sats_in_mempool: number
}

type LabelRow = {
  ref: string
  account_id: string
  type: string
  label: string
  fee: number | null
  fmv: string | null
  height: number | null
  heights: string | null
  keypath: string | null
  origin: string | null
  rate: string | null
  spendable: number | null
  time: string | null
  value: number | null
}

type NostrDmRow = {
  id: string
  account_id: string
  author: string
  created_at: number
  description: string
  event: string
  label: number
  content_description: string | null
  content_created_at: number | null
  content_pubkey: string | null
  pending: number
  read: number | null
}

function parseJson<T>(json: string | null, fallback: T): T {
  if (!json) {
    return fallback
  }
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

function rowToAccount(
  row: AccountRow,
  transactions: Transaction[],
  utxos: Utxo[],
  addresses: Address[],
  labels: Record<string, Label>,
  nostrDms: NostrDM[],
  nostrRelays: string[],
  trustedDevices: string[]
): Account {
  const syncProgress: SyncProgress | undefined =
    row.sync_progress_total !== null
      ? {
          tasksDone: row.sync_progress_done ?? 0,
          totalTasks: row.sync_progress_total
        }
      : undefined

  const nostr: NostrAccount = {
    autoSync: row.nostr_auto_sync === 1,
    commonNpub: row.nostr_common_npub,
    commonNsec: row.nostr_common_nsec,
    deviceDisplayName: row.nostr_device_display_name ?? undefined,
    deviceNpub: row.nostr_device_npub ?? undefined,
    deviceNsec: row.nostr_device_nsec ?? undefined,
    devicePicture: row.nostr_device_picture ?? undefined,
    dms: nostrDms,
    lastBackupFingerprint: row.nostr_last_backup_fingerprint ?? undefined,
    lastUpdated: row.nostr_last_updated
      ? new Date(row.nostr_last_updated)
      : new Date(),
    npubAliases: parseJson(row.nostr_npub_aliases, {}),
    npubProfiles: parseJson(row.nostr_npub_profiles, {}),
    relays: nostrRelays,
    syncStart: row.nostr_sync_start
      ? new Date(row.nostr_sync_start)
      : new Date(),
    trustedMemberDevices: trustedDevices
  }

  return {
    addresses,
    createdAt: new Date(row.created_at),
    id: row.id,
    keyCount: row.key_count,
    keys: parseJson<KeyMeta[]>(row.keys, []).map(
      (meta): Key => ({ ...meta, iv: '', secret: '' })
    ),
    keysRequired: row.keys_required,
    labels,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
    name: row.name,
    network: row.network as Account['network'],
    nostr,
    policyType: row.policy_type as Account['policyType'],
    summary: {
      balance: row.balance,
      numberOfAddresses: row.num_addresses,
      numberOfTransactions: row.num_transactions,
      numberOfUtxos: row.num_utxos,
      satsInMempool: row.sats_in_mempool
    },
    syncProgress,
    syncStatus: row.sync_status as Account['syncStatus'],
    transactions,
    utxos
  }
}

function rowToTransaction(
  row: TransactionRow,
  inputs: TxInputRow[],
  outputs: TxOutputRow[]
): Transaction {
  return {
    address: row.address ?? undefined,
    blockHeight: row.block_height ?? undefined,
    fee: row.fee ?? undefined,
    id: row.id,
    label: row.label ?? '',
    lockTime: row.lock_time ?? undefined,
    lockTimeEnabled: row.lock_time_enabled === 1,
    prices: parseJson(row.prices, {}),
    raw: parseJson<number[] | undefined>(row.raw, undefined),
    received: row.received,
    sent: row.sent,
    size: row.size ?? undefined,
    timestamp: row.timestamp ? new Date(row.timestamp) : undefined,
    type: row.type as Transaction['type'],
    version: row.version ?? undefined,
    vin: inputs.map((input) => ({
      label: input.label ?? undefined,
      previousOutput: {
        txid: input.prev_txid,
        vout: input.prev_vout
      },
      scriptSig: parseJson<number[] | string>(input.script_sig, ''),
      sequence: input.sequence,
      value: input.value ?? undefined,
      witness: parseJson<number[][]>(input.witness, [])
    })),
    vout: outputs.map((output) => ({
      address: output.address,
      label: output.label ?? undefined,
      script: parseJson<number[] | string>(output.script, ''),
      value: output.value
    })),
    vsize: row.vsize ?? undefined,
    weight: row.weight ?? undefined
  }
}

function rowToUtxo(row: UtxoRow): Utxo {
  return {
    addressTo: row.address_to ?? undefined,
    keychain: row.keychain as Utxo['keychain'],
    label: row.label ?? '',
    script: parseJson<number[] | string | undefined>(row.script, undefined),
    timestamp: row.timestamp ? new Date(row.timestamp) : undefined,
    txid: row.txid,
    value: row.value,
    vout: row.vout
  }
}

function rowToAddress(
  row: AddressRow,
  txIds: string[],
  utxoRefs: string[]
): Address {
  return {
    address: row.address,
    derivationPath: row.derivation_path ?? undefined,
    index: row.addr_index ?? undefined,
    keychain: (row.keychain as Address['keychain']) ?? undefined,
    label: row.label ?? '',
    network: (row.network as Address['network']) ?? undefined,
    scriptVersion:
      (row.script_version as Address['scriptVersion']) ?? undefined,
    summary: {
      balance: row.balance,
      satsInMempool: row.sats_in_mempool,
      transactions: row.tx_count,
      utxos: row.utxo_count
    },
    transactions: txIds,
    utxos: utxoRefs
  }
}

function rowToLabel(row: LabelRow): Label {
  return {
    fee: row.fee ?? undefined,
    fmv: parseJson(row.fmv, undefined),
    height: row.height ?? undefined,
    heights: parseJson(row.heights, undefined),
    keypath: row.keypath ?? undefined,
    label: row.label,
    origin: row.origin ?? undefined,
    rate: parseJson(row.rate, undefined),
    ref: row.ref,
    spendable: row.spendable !== null ? row.spendable === 1 : undefined,
    time: row.time ? new Date(row.time) : undefined,
    type: row.type as Label['type'],
    value: row.value ?? undefined
  }
}

function rowToNostrDm(row: NostrDmRow): NostrDM {
  return {
    author: row.author,
    content: {
      created_at: row.content_created_at ?? 0,
      description: row.content_description ?? '',
      pubkey: row.content_pubkey ?? undefined
    },
    created_at: row.created_at,
    description: row.description,
    event: row.event,
    id: row.id,
    label: row.label,
    pending: row.pending === 1 ? true : undefined,
    read: row.read === null ? undefined : row.read === 1
  }
}

function dateToIso(date: Date | undefined | null): string | null {
  if (!date) {
    return null
  }
  return date.toISOString()
}

function boolToInt(value: boolean | undefined): number {
  return value ? 1 : 0
}

function optionalToJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  return JSON.stringify(value)
}

export {
  boolToInt,
  dateToIso,
  optionalToJson,
  parseJson,
  rowToAccount,
  rowToAddress,
  rowToLabel,
  rowToNostrDm,
  rowToTransaction,
  rowToUtxo
}

export type {
  AccountRow,
  AddressRow,
  LabelRow,
  NostrDmRow,
  TransactionRow,
  TxInputRow,
  TxOutputRow,
  UtxoRow
}
