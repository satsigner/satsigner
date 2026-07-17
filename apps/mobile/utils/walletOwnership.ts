import { type BdkWallet, KeychainKind } from 'react-native-bdk-sdk'

import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Transaction } from '@/types/models/Transaction'
import { getAccountAddressSets } from '@/utils/address'
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
 * Tag internal outputs as change and fix send `received`/`sent` from ownership
 * so card amount and running balance are payment (+ fee), not every output.
 */
function annotateTransactionsWithWalletOwnership(
  transactions: Transaction[],
  accountAddresses: Account['addresses']
): Transaction[] {
  const { internalAddresses, ownAddresses } =
    getAccountAddressSets(accountAddresses)

  if (ownAddresses.size === 0) {
    return transactions
  }

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

    if (transaction.sent <= 0) {
      return { ...transaction, vout }
    }

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
 * Post-tx running wallet balances keyed by txid. Always accumulates oldest →
 * newest so sort direction cannot scramble card totals.
 */
function getTransactionRunningBalances(
  transactions: Transaction[]
): Map<string, number> {
  // This codebase's sort helper uses inverted names: 'desc' ⇒ oldest first.
  const chronological = sortTransactions(transactions, 'desc')
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
  getTransactionRunningBalances
}
