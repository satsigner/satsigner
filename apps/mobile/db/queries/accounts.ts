import { type Account } from '@/types/models/Account'

import { getDb } from '../connection'
import {
  type AccountRow,
  type TxInputRow,
  type TxOutputRow,
  rowToAccount,
  rowToAddress,
  rowToNostrDm,
  rowToTransaction,
  rowToUtxo
} from '../mappers'
import { getAddressTxIds, getAddressUtxoRefs } from './addresses'
import { getLabelsByAccount } from './labels'

function getAccounts(): Account[] {
  const db = getDb()
  const { results } = db.execute('SELECT * FROM accounts')
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
  const transactions = (txRows ?? []).map((txRow) => {
    const { results: inputRows } = db.execute(
      'SELECT * FROM tx_inputs WHERE tx_id = ? AND account_id = ? ORDER BY input_index',
      [txRow.id as string, accountId]
    )
    const { results: outputRows } = db.execute(
      'SELECT * FROM tx_outputs WHERE tx_id = ? AND account_id = ? ORDER BY output_index',
      [txRow.id as string, accountId]
    )
    return rowToTransaction(
      txRow as unknown as Parameters<typeof rowToTransaction>[0],
      (inputRows ?? []) as unknown as TxInputRow[],
      (outputRows ?? []) as unknown as TxOutputRow[]
    )
  })

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
  const addresses = (addrRows ?? []).map((addrRow) => {
    const txIds = getAddressTxIds(accountId, addrRow.address as string)
    const utxoRefs = getAddressUtxoRefs(accountId, addrRow.address as string)
    return rowToAddress(
      addrRow as Parameters<typeof rowToAddress>[0],
      txIds,
      utxoRefs
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
