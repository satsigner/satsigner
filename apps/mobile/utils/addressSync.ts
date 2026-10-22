import * as bitcoinjs from 'bitcoinjs-lib'

import { type AddressSnapshot } from '@/api/addressSync'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { type Network } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { getUtxoOutpoint } from '@/utils/outpoint'

/**
 * Merges one address snapshot into a watch-only address account.
 * Transactions are upserted by id. The address' UTXOs are replaced by the
 * snapshot set, reusing stored UTXOs (and their labels) by outpoint, so
 * spent outputs drop out. Stored UTXOs take the snapshot timestamp when it
 * has one. Balance totals are added to the account summary:
 * the caller zeroes them before syncing the account's addresses.
 */
export function applyAddressSnapshot(
  account: Account,
  address: string,
  network: Network,
  snapshot: AddressSnapshot
): Account {
  const snapshotTxids = new Set(snapshot.transactions.map((tx) => tx.id))
  const transactions = [
    ...account.transactions.filter((tx) => !snapshotTxids.has(tx.id)),
    ...snapshot.transactions
  ]

  const storedUtxos = new Map(
    account.utxos.map((utxo) => [getUtxoOutpoint(utxo), utxo])
  )
  const script = [
    ...bitcoinjs.address.toOutputScript(address, bitcoinjsNetwork(network))
  ]
  const addressUtxos = snapshot.utxos.map((utxo): Utxo => {
    const stored = storedUtxos.get(getUtxoOutpoint(utxo))
    if (stored) {
      return { ...stored, timestamp: utxo.timestamp ?? stored.timestamp }
    }
    return {
      addressTo: address,
      // Watch-only address accounts track receive addresses.
      keychain: 'external',
      label: '',
      script,
      timestamp: utxo.timestamp,
      txid: utxo.txid,
      value: utxo.value,
      vout: utxo.vout
    }
  })

  return {
    ...account,
    addresses: [
      ...account.addresses.filter((entry) => entry.address !== address),
      {
        address,
        label: '',
        summary: {
          balance: snapshot.balance.confirmed,
          satsInMempool: snapshot.balance.unconfirmed,
          transactions: snapshot.txids.length,
          utxos: snapshot.utxos.length
        },
        transactions: snapshot.txids,
        utxos: snapshot.utxos.map(getUtxoOutpoint)
      }
    ],
    summary: {
      ...account.summary,
      balance: account.summary.balance + snapshot.balance.confirmed,
      satsInMempool:
        account.summary.satsInMempool + snapshot.balance.unconfirmed
    },
    transactions,
    utxos: [
      ...account.utxos.filter((utxo) => utxo.addressTo !== address),
      ...addressUtxos
    ]
  }
}
