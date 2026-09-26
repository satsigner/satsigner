import { type Account } from '@/types/models/Account'

import { getDb } from '../connection'
import {
  type AccountRow,
  type AddressRow,
  type NostrDmRow,
  type TransactionRow,
  type UtxoRow,
  rowToAccount,
  rowToAddress,
  rowToNostrDm,
  rowToUtxo
} from '../mappers'
import {
  getAddressTxIdsByAccount,
  getAddressUtxoRefsByAccount,
  hydrateTransactionRows
} from './children'
import { getLabelsByAccount } from './labels'

function getAccounts(): Account[] {
  const db = getDb()
  const { rows } = db.execute<AccountRow>(
    'SELECT * FROM accounts ORDER BY display_index ASC'
  )
  return rows._array.map((row) => hydrateAccount(row))
}

function getAccountById(id: string): Account | undefined {
  const db = getDb()
  const row = db
    .execute<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id])
    .rows.item(0)
  if (!row) {
    return undefined
  }
  return hydrateAccount(row)
}

function hydrateAccount(row: AccountRow): Account {
  const db = getDb()
  const accountId = row.id

  const { rows: txRows } = db.execute<TransactionRow>(
    'SELECT * FROM transactions WHERE account_id = ?',
    [accountId]
  )
  const transactions = hydrateTransactionRows(txRows._array, accountId)

  const { rows: utxoRows } = db.execute<UtxoRow>(
    'SELECT * FROM utxos WHERE account_id = ?',
    [accountId]
  )
  const utxos = utxoRows._array.map((row) => rowToUtxo(row))

  const { rows: addrRows } = db.execute<AddressRow>(
    'SELECT * FROM addresses WHERE account_id = ?',
    [accountId]
  )
  const addressTxIds = getAddressTxIdsByAccount(accountId)
  const addressUtxoRefs = getAddressUtxoRefsByAccount(accountId)
  const addresses = addrRows._array.map((addrRow) =>
    rowToAddress(
      addrRow,
      addressTxIds.get(addrRow.address) ?? [],
      addressUtxoRefs.get(addrRow.address) ?? []
    )
  )

  const labels = getLabelsByAccount(accountId)

  const { rows: dmRows } = db.execute<NostrDmRow>(
    'SELECT * FROM nostr_dms WHERE account_id = ? ORDER BY created_at DESC',
    [accountId]
  )
  const dms = dmRows._array.map((row) => rowToNostrDm(row))

  const { rows: relayRows } = db.execute<{ url: string }>(
    'SELECT url FROM nostr_relays WHERE account_id = ?',
    [accountId]
  )
  const relays = relayRows._array.map((r) => r.url)

  const { rows: deviceRows } = db.execute<{ device_npub: string }>(
    'SELECT device_npub FROM nostr_trusted_devices WHERE account_id = ?',
    [accountId]
  )
  const trustedDevices = deviceRows._array.map((d) => d.device_npub)

  return rowToAccount(
    row,
    transactions,
    utxos,
    addresses,
    labels,
    dms,
    relays,
    trustedDevices
  )
}

export { getAccountById, getAccounts }
