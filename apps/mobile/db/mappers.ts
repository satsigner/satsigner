import { type Label, type LabelType } from '@/types/bips/329'
import {
  type Account,
  type Key,
  type KeyMeta,
  type PolicyType,
  type SyncProgress,
  type SyncStatus
} from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Prices, PricesSchema } from '@/types/models/Blockchain'
import {
  type NostrAccount,
  NostrAccountSchema,
  type NostrDM
} from '@/types/models/Nostr'
import { type ScriptVersionType } from '@/types/models/Script'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Network } from '@/types/settings/blockchain'
import { isNumberArray, isStringArray } from '@/utils/array'

type AccountRow = {
  id: string
  name: string
  network: Network
  policy_type: PolicyType
  display_index: number
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
  sync_status: SyncStatus
  sync_progress_total: number | null
  sync_progress_done: number | null
  birthday_date: string | null
  rpc_last_block_hash: string | null
  excluded_utxo_outpoints: string | null
  nostr_auto_sync: number
  nostr_common_npub: string
  nostr_common_nsec: string
  nostr_device_npub: string | null
  nostr_device_nsec: string | null
  nostr_device_mnemonic: string | null
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
  type: Transaction['type']
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
  keychain: Utxo['keychain']
  script: string | null
}

type AddressRow = {
  address: string
  account_id: string
  label: string | null
  derivation_path: string | null
  addr_index: number | null
  keychain: NonNullable<Address['keychain']> | null
  network: Network | null
  script_version: ScriptVersionType | null
  utxo_count: number
  tx_count: number
  balance: number
  sats_in_mempool: number
}

type LabelRow = {
  ref: string
  account_id: string
  type: LabelType
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

type ArkLabelRow = {
  ref: string
  account_id: string
  type: LabelType
  label: string
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

/**
 * Reads a JSON column, returning undefined when it is empty, malformed or its
 * value fails `isValid`. Callers apply the column's fallback with `??`.
 */
function parseJson<T>(
  json: string | null,
  isValid: (value: unknown) => value is T
): T | undefined {
  if (!json) {
    return undefined
  }
  try {
    const value: unknown = JSON.parse(json)
    return isValid(value) ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Reads a JSON column whose stored values the domain types do not fully
 * describe, so validating them would drop real data. Returns undefined only
 * when the column is empty or malformed. Used for key metadata (slots cleared
 * by resetKey have no creationType) and the BIP-329 fmv/rate/heights fields,
 * which label imports store as given.
 */
function parseUncheckedJson<T>(json: string | null): T | undefined {
  if (!json) {
    return undefined
  }
  try {
    return JSON.parse(json) as T
  } catch {
    return undefined
  }
}

function isScript(value: unknown): value is number[] | string {
  return typeof value === 'string' || isNumberArray(value)
}

function isWitness(value: unknown): value is number[][] {
  return Array.isArray(value) && value.every(isNumberArray)
}

function isPrices(value: unknown): value is Prices {
  return PricesSchema.safeParse(value).success
}

function isNpubAliases(value: unknown): value is NostrAccount['npubAliases'] {
  return NostrAccountSchema.shape.npubAliases.safeParse(value).success
}

function isNpubProfiles(value: unknown): value is NostrAccount['npubProfiles'] {
  return NostrAccountSchema.shape.npubProfiles.safeParse(value).success
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
    deviceMnemonic: row.nostr_device_mnemonic ?? undefined,
    deviceNpub: row.nostr_device_npub ?? undefined,
    deviceNsec: row.nostr_device_nsec ?? undefined,
    devicePicture: row.nostr_device_picture ?? undefined,
    dms: nostrDms,
    lastBackupFingerprint: row.nostr_last_backup_fingerprint ?? undefined,
    lastUpdated: row.nostr_last_updated
      ? new Date(row.nostr_last_updated)
      : new Date(),
    npubAliases: parseJson(row.nostr_npub_aliases, isNpubAliases) ?? {},
    npubProfiles: parseJson(row.nostr_npub_profiles, isNpubProfiles) ?? {},
    relays: nostrRelays,
    syncStart: row.nostr_sync_start
      ? new Date(row.nostr_sync_start)
      : new Date(),
    trustedMemberDevices: trustedDevices
  }

  return {
    addresses,
    birthdayDate: row.birthday_date ? new Date(row.birthday_date) : undefined,
    createdAt: new Date(row.created_at),
    displayIndex: row.display_index,
    excludedUtxoOutpoints:
      parseJson(row.excluded_utxo_outpoints, isStringArray) ?? [],
    id: row.id,
    keyCount: row.key_count,
    keys: (parseUncheckedJson<KeyMeta[]>(row.keys) ?? []).map(
      (meta): Key => ({ ...meta, accountId: row.id, iv: '', secret: '' })
    ),
    keysRequired: row.keys_required,
    labels,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : undefined,
    name: row.name,
    network: row.network,
    nostr,
    policyType: row.policy_type,
    rpcLastBlockHash: row.rpc_last_block_hash ?? undefined,
    summary: {
      balance: row.balance,
      numberOfAddresses: row.num_addresses,
      numberOfTransactions: row.num_transactions,
      numberOfUtxos: row.num_utxos,
      satsInMempool: row.sats_in_mempool
    },
    syncProgress,
    syncStatus: row.sync_status,
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
    prices: parseJson(row.prices, isPrices) ?? {},
    raw: parseJson(row.raw, isNumberArray),
    received: row.received,
    sent: row.sent,
    size: row.size ?? undefined,
    timestamp: row.timestamp ? new Date(row.timestamp) : undefined,
    type: row.type,
    version: row.version ?? undefined,
    vin: inputs.map((input) => ({
      label: input.label ?? undefined,
      previousOutput: {
        txid: input.prev_txid,
        vout: input.prev_vout
      },
      scriptSig: parseJson(input.script_sig, isScript) ?? '',
      sequence: input.sequence,
      value: input.value ?? undefined,
      witness: parseJson(input.witness, isWitness) ?? []
    })),
    vout: outputs.map((output) => ({
      address: output.address,
      label: output.label ?? undefined,
      script: parseJson(output.script, isScript) ?? '',
      value: output.value
    })),
    vsize: row.vsize ?? undefined,
    weight: row.weight ?? undefined
  }
}

function rowToUtxo(row: UtxoRow): Utxo {
  return {
    addressTo: row.address_to ?? undefined,
    keychain: row.keychain,
    label: row.label ?? '',
    script: parseJson(row.script, isScript),
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
    keychain: row.keychain ?? undefined,
    label: row.label ?? '',
    network: row.network ?? undefined,
    scriptVersion: row.script_version ?? undefined,
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
    fmv: parseUncheckedJson<Label['fmv']>(row.fmv),
    height: row.height ?? undefined,
    heights: parseUncheckedJson<Label['heights']>(row.heights),
    keypath: row.keypath ?? undefined,
    label: row.label,
    origin: row.origin ?? undefined,
    rate: parseUncheckedJson<Label['rate']>(row.rate),
    ref: row.ref,
    spendable: row.spendable !== null ? row.spendable === 1 : undefined,
    time: row.time ? new Date(row.time) : undefined,
    type: row.type,
    value: row.value ?? undefined
  }
}

function rowToArkLabel(row: ArkLabelRow): Label {
  return {
    label: row.label,
    ref: row.ref,
    type: row.type
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

/**
 * Serialises a date column. Anything that is not a valid Date at runtime (for
 * example an unrevived ISO string from JSON) is stored as null instead of
 * failing the whole write.
 */
function dateToIso(date: Date | undefined | null): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
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
  parseUncheckedJson,
  rowToAccount,
  rowToAddress,
  rowToArkLabel,
  rowToLabel,
  rowToNostrDm,
  rowToTransaction,
  rowToUtxo
}

export type {
  AccountRow,
  AddressRow,
  ArkLabelRow,
  LabelRow,
  NostrDmRow,
  TransactionRow,
  TxInputRow,
  TxOutputRow,
  UtxoRow
}
