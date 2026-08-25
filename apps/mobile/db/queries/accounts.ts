import { type Account } from '@/types/models/Account'

import { getDb } from '../connection'
import {
  type AccountRow,
  type TransactionRow,
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
  const { results } = db.execute(
    'SELECT * FROM accounts ORDER BY display_index ASC'
  )
  return (results as AccountRow[]).map((row) => hydrateAccount(row))
}

function getAccountById(id: string): Account | undefined {
  const db = getDb()
  const { results } = db.execute('SELECT * FROM accounts WHERE id = ?', [id])
  if (!results || results.length === 0) {
    return undefined
  }
  return hydrateAccount(results[0] as AccountRow)
}

function hydrateAccount(row: AccountRow): Account {
  const db = getDb()
  const accountId = row.id

  // Transactions with vin/vout
  const { results: txRows } = db.execute(
    'SELECT * FROM transactions WHERE account_id = ?',
    [accountId]
  )
  const transactions = hydrateTransactionRows(
    (txRows ?? []) as TransactionRow[],
    accountId
  )

  // UTXOs
  const { results: utxoRows } = db.execute(
    'SELECT * FROM utxos WHERE account_id = ?',
    [accountId]
  )
  const utxos = (utxoRows ?? []).map((row) =>
    rowToUtxo(row as unknown as Parameters<typeof rowToUtxo>[0])
  )

  // Addresses
  const { results: addrRows } = db.execute(
    'SELECT * FROM addresses WHERE account_id = ?',
    [accountId]
  )
  const addressTxIds = getAddressTxIdsByAccount(accountId)
  const addressUtxoRefs = getAddressUtxoRefsByAccount(accountId)
  const addresses = (addrRows ?? []).map((addrRow) => {
    const address = addrRow.address as string
    return rowToAddress(
      addrRow as Parameters<typeof rowToAddress>[0],
      addressTxIds.get(address) ?? [],
      addressUtxoRefs.get(address) ?? []
    )
  })

  // Labels
  const labels = getLabelsByAccount(accountId)

  // Nostr DMs
  const { results: dmRows } = db.execute(
    'SELECT * FROM nostr_dms WHERE account_id = ? ORDER BY created_at DESC',
    [accountId]
  )
  const dms = (dmRows ?? []).map((row) =>
    rowToNostrDm(row as unknown as Parameters<typeof rowToNostrDm>[0])
  )

  // Nostr relays
  const { results: relayRows } = db.execute(
    'SELECT url FROM nostr_relays WHERE account_id = ?',
    [accountId]
  )
  const relays = (relayRows ?? []).map((r) => r.url as string)

  // Nostr trusted devices
  const { results: deviceRows } = db.execute(
    'SELECT device_npub FROM nostr_trusted_devices WHERE account_id = ?',
    [accountId]
  )
  const trustedDevices = (deviceRows ?? []).map((d) => d.device_npub as string)

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
