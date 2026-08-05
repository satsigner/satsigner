import { type BdkWallet, KeychainKind } from 'react-native-bdk-sdk'

import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { getAccountAddressSets } from '@/utils/address'
import {
  buildOwnedOutpoints,
  isOwnedOutpoint
} from '@/utils/sankeyInputOwnership'
import { sortTransactions } from '@/utils/sort'

const MAX_OWNERSHIP_ADDRESS_SCAN = 1000

function makeAddressEntry(
  address: string,
  index: number,
  keychain: 'external' | 'internal',
  network: Address['network']
): Address {
  return {
    address,
    index,
    keychain,
    label: '',
    network,
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [],
    utxos: []
  }
}

/** Collect every output address seen in wallet transactions. */
function collectTransactionOutputAddresses(
  transactions: Transaction[]
): Set<string> {
  const seen = new Set<string>()
  for (const transaction of transactions) {
    for (const output of transaction.vout) {
      const address = output.address?.trim()
      if (address) {
        seen.add(address)
      }
    }
  }
  return seen
}

/**
 * Ensure addresses that appear on our txs are tracked even when they sit past
 * the stop-gap window used for the initial peek (Sparrow ownership model).
 */
function ensureAddressesIncludeSeenOutputs(
  wallet: BdkWallet,
  network: Address['network'],
  addresses: Account['addresses'],
  seenOutputAddresses: Set<string>
): Account['addresses'] {
  const tracked = new Set(
    addresses.map((entry) => entry.address.trim()).filter(Boolean)
  )
  const missing = [...seenOutputAddresses].filter(
    (address) => !tracked.has(address)
  )
  if (missing.length === 0) {
    return addresses
  }

  const missingSet = new Set(missing)
  const next = [...addresses]

  for (
    let index = 0;
    index < MAX_OWNERSHIP_ADDRESS_SCAN && missingSet.size > 0;
    index += 1
  ) {
    const external = wallet.peekAddress(KeychainKind.External, index)?.address
    if (external && missingSet.has(external)) {
      next.push(makeAddressEntry(external, index, 'external', network))
      missingSet.delete(external)
    }

    const internal = wallet.peekAddress(KeychainKind.Internal, index)?.address
    if (internal && missingSet.has(internal)) {
      next.push(makeAddressEntry(internal, index, 'internal', network))
      missingSet.delete(internal)
    }
  }

  return next
}

/**
 * True when `sent` looks like a net payment (Core listtransactions) rather than
 * the sum of owned inputs (BDK). Inflating sent from full tx outputs would be
 * wrong for coinjoins, so only reconstruct in these undercount shapes.
 */
function shouldReconstructOwnedInputs(params: {
  external: number
  fee: number
  returned: number
  sent: number
}): boolean {
  const { external, fee, returned, sent } = params
  if (sent < returned) {
    return true
  }
  if (external > 0 && (sent === external || sent === external + fee)) {
    return true
  }
  return false
}

/**
 * Map outpoint → sats from wallet history / UTXOs so Payjoin annotation works
 * before the tx-detail screen hydrates `vin[].value` from Electrum/Esplora.
 */
function buildOutpointValueMap(
  transactions: Transaction[],
  utxos?: Utxo[]
): Map<string, number> {
  const values = new Map<string, number>()

  for (const utxo of utxos ?? []) {
    if (typeof utxo.value === 'number') {
      values.set(`${utxo.txid}:${utxo.vout}`, utxo.value)
    }
  }

  for (const tx of transactions) {
    if (!tx.id) {
      continue
    }
    for (let index = 0; index < (tx.vout?.length ?? 0); index += 1) {
      const output = tx.vout?.[index]
      if (output && typeof output.value === 'number') {
        values.set(`${tx.id}:${index}`, output.value)
      }
    }
  }

  return values
}

function resolveInputValue(
  input: Transaction['vin'][number],
  outpointValues: ReadonlyMap<string, number>
): number | undefined {
  if (typeof input.value === 'number') {
    return input.value
  }
  const txid = input.previousOutput?.txid
  const vout = input.previousOutput?.vout
  if (!txid || typeof vout !== 'number') {
    return undefined
  }
  return outpointValues.get(`${txid}:${vout}`)
}

/**
 * Tag internal outputs as change and fix send `received`/`sent` from ownership
 * so card amount and running balance are payment (+ fee), not every output.
 *
 * Mixed-ownership txs (Payjoin): count only our inputs/outputs so a receive
 * Payjoin is net-positive instead of a huge fake send.
 */
function annotateTransactionsWithWalletOwnership(
  transactions: Transaction[],
  accountAddresses: Account['addresses'],
  utxos?: Utxo[]
): Transaction[] {
  const { internalAddresses, ownAddresses } =
    getAccountAddressSets(accountAddresses)

  if (ownAddresses.size === 0) {
    return transactions
  }

  const ownedOutpoints = buildOwnedOutpoints({
    addresses: accountAddresses,
    transactions,
    utxos
  })
  const outpointValues = buildOutpointValueMap(transactions, utxos)

  return transactions.map((transaction) => {
    const vout = transaction.vout.map((output) => {
      const address = output.address?.trim()
      if (!address || !internalAddresses.has(address)) {
        return output
      }
      if (output.kind === 'change') {
        return output
      }
      return { ...output, kind: 'change' as const }
    })

    let returned = 0
    let external = 0
    for (const output of vout) {
      const address = output.address?.trim()
      if (address && ownAddresses.has(address)) {
        returned += output.value
      } else {
        external += output.value
      }
    }

    let ownInputSum = 0
    let ownInputCount = 0
    let foreignInputCount = 0
    for (const input of transaction.vin ?? []) {
      const owned = isOwnedOutpoint(
        ownedOutpoints,
        input.previousOutput?.txid,
        input.previousOutput?.vout
      )
      if (owned === undefined) {
        continue
      }
      const value = resolveInputValue(input, outpointValues) ?? 0
      if (owned) {
        ownInputCount += 1
        ownInputSum += value
      } else {
        foreignInputCount += 1
      }
    }

    // Ownership alone is enough — do not require hydrated input values.
    // BDK omits vin.value until the detail screen fetches prevouts.
    const mixedOwnership = ownInputCount > 0 && foreignInputCount > 0

    if (mixedOwnership) {
      const sent = ownInputSum
      const received = returned
      const type: Transaction['type'] = received >= sent ? 'receive' : 'send'
      return {
        ...transaction,
        received,
        sent,
        type,
        vout
      }
    }

    if (transaction.sent <= 0) {
      return { ...transaction, vout }
    }

    const fee = transaction.fee ?? 0
    const received = Math.max(transaction.received, returned)
    const reconstructedSent = returned + external + fee
    const sent = shouldReconstructOwnedInputs({
      external,
      fee,
      returned,
      sent: transaction.sent
    })
      ? Math.max(transaction.sent, reconstructedSent)
      : transaction.sent

    return {
      ...transaction,
      received,
      sent,
      vout
    }
  })
}

/**
 * Wallet balance effect for UI: receive/send amount after ownership annotation.
 * For Payjoin receive this is net gain (own outputs − own inputs), not gross.
 */
function getWalletTransactionEffect(tx: {
  received?: number
  sent?: number
  type?: Transaction['type']
}): { amount: number; type: 'receive' | 'send' } {
  const received = tx.received || 0
  const sent = tx.sent || 0
  const net = received - sent
  if (net > 0) {
    return { amount: net, type: 'receive' }
  }
  if (net < 0) {
    return { amount: -net, type: 'send' }
  }
  return {
    amount: 0,
    type: tx.type === 'receive' ? 'receive' : 'send'
  }
}

/**
 * Post-tx running wallet balances keyed by txid. Always accumulates oldest →
 * newest so sort direction cannot scramble card totals.
 */
function getTransactionRunningBalances(
  transactions: Transaction[]
): Map<string, number> {
  // Oldest → newest so running balances accumulate correctly.
  const chronological = sortTransactions(transactions, 'asc', 'date')
  let balance = 0
  const balances = new Map<string, number>()

  for (const transaction of chronological) {
    balance += (transaction.received || 0) - (transaction.sent || 0)
    balances.set(transaction.id, balance)
  }

  return balances
}

export {
  annotateTransactionsWithWalletOwnership,
  collectTransactionOutputAddresses,
  ensureAddressesIncludeSeenOutputs,
  getTransactionRunningBalances,
  getWalletTransactionEffect
}
