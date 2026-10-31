import { hex } from '@scure/base'
import {
  addressFromScript,
  type BdkWallet,
  KeychainKind,
  type LocalOutputN,
  type Network,
  type TxDetailsN
} from 'react-native-bdk-sdk'

import { MS_PER_SECOND } from '@/constants/time'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Network as BlockchainNetwork } from '@/types/settings/blockchain'
import { peekDerivedAddress } from '@/utils/derivedAddress'
import { parseAccountAddressesDetails } from '@/utils/parse'
import { getRawTransactionSizes } from '@/utils/transaction'
import {
  annotateTransactionsWithWalletOwnership,
  collectTransactionOutputAddresses,
  ensureAddressesIncludeSeenOutputs,
  makeAddressEntry
} from '@/utils/walletOwnership'

function toAppNetwork(network: Network): BlockchainNetwork {
  switch (network) {
    case 0: {
      return 'bitcoin'
    }
    case 2: {
      return 'signet'
    }
    default: {
      return 'testnet'
    }
  }
}

function lastUsedIndexForKeychain(
  addresses: Account['addresses'],
  keychain: 'external' | 'internal'
): number {
  return addresses.reduce((lastUsed, address) => {
    if (address.keychain !== keychain) {
      return lastUsed
    }
    if (address.index === undefined) {
      return lastUsed
    }
    if (address.index > lastUsed) {
      return address.index
    }
    return lastUsed
  }, -1)
}

type CoreDescriptorIndex = {
  internal: boolean
  next_index: number
  range: [number, number]
}

type CoreKeychainMaxIndex = {
  external?: number
  internal?: number
}

/**
 * Highest derivation index Bitcoin Core has in the keypool for a keychain.
 * Uses both next_index and range end so a Core-extended range past the app
 * stop gap / 999 ownership peek is not dropped on the next BDK sync.
 */
function maxCoreKeychainIndex(
  descriptors: CoreDescriptorIndex[],
  internal: boolean
): number {
  return descriptors.reduce((maxIndex, entry) => {
    if (entry.internal !== internal) {
      return maxIndex
    }
    const candidate = Math.max(entry.next_index - 1, entry.range[1])
    if (candidate > maxIndex) {
      return candidate
    }
    return maxIndex
  }, -1)
}

function lastIndexToReveal(
  addresses: Account['addresses'],
  keychain: 'external' | 'internal',
  coreMaxIndex?: number
): number {
  const fromAccount = lastUsedIndexForKeychain(addresses, keychain)
  if (coreMaxIndex === undefined || coreMaxIndex < 0) {
    return fromAccount
  }
  if (fromAccount > coreMaxIndex) {
    return fromAccount
  }
  return coreMaxIndex
}

type RevealWallet = Pick<
  BdkWallet,
  'nextDerivationIndex' | 'persist' | 'revealNextAddress'
>

function revealKeychainThroughStopGap(
  wallet: RevealWallet,
  keychainKind: KeychainKind,
  lastUsedIndex: number,
  stopGap: number
) {
  if (lastUsedIndex < 0) {
    return
  }

  const targetNextIndex = lastUsedIndex + stopGap + 1
  while (wallet.nextDerivationIndex(keychainKind) < targetNextIndex) {
    const revealed = wallet.revealNextAddress(keychainKind)
    // A descriptor without a wildcard has one script, and BDK keeps its next
    // derivation index at 0 after revealing it.
    if (revealed.index >= wallet.nextDerivationIndex(keychainKind)) {
      return
    }
  }
}

function appendAddressAtIndex(
  wallet: BdkWallet,
  addresses: Account['addresses'],
  keychain: 'external' | 'internal',
  index: number,
  network: Account['addresses'][number]['network']
): Account['addresses'] {
  if (index < 0) {
    return addresses
  }
  const alreadyTracked = addresses.some(
    (address) => address.keychain === keychain && address.index === index
  )
  if (alreadyTracked) {
    return addresses
  }
  const kind =
    keychain === 'external' ? KeychainKind.External : KeychainKind.Internal
  return [
    ...addresses,
    {
      address: wallet.peekAddress(kind, index).address,
      index,
      keychain,
      label: '',
      network,
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    }
  ]
}

/**
 * Reveal scripts BDK already should know from stored account indices, plus
 * the current stop gap. Optional Core maxima cover descriptor ranges past
 * stopGap and the 999 ownership peek. Used before incremental Electrum/Esplora
 * sync after RPC (or any path that skipped BDK keychain updates).
 */
function revealKnownAddresses(
  wallet: RevealWallet,
  account: Pick<Account, 'addresses'>,
  stopGap: number,
  coreMaxIndex?: CoreKeychainMaxIndex
) {
  revealKeychainThroughStopGap(
    wallet,
    KeychainKind.External,
    lastIndexToReveal(account.addresses, 'external', coreMaxIndex?.external),
    stopGap
  )
  revealKeychainThroughStopGap(
    wallet,
    KeychainKind.Internal,
    lastIndexToReveal(account.addresses, 'internal', coreMaxIndex?.internal),
    stopGap
  )
  wallet.persist()
}

function peekAddressesAtIndex(
  wallet: BdkWallet,
  network: Network,
  index: number
): Account['addresses'] {
  const appNetwork = toAppNetwork(network)
  const external = peekDerivedAddress(wallet, KeychainKind.External, index)
  const internal = peekDerivedAddress(wallet, KeychainKind.Internal, index)
  return [
    ...(external
      ? [makeAddressEntry(external.address, index, 'external', appNetwork)]
      : []),
    ...(internal
      ? [makeAddressEntry(internal.address, index, 'internal', appNetwork)]
      : [])
  ]
}

function getWalletAddresses(
  wallet: BdkWallet,
  network: Network,
  count = 10
): Account['addresses'] {
  const addresses: Account['addresses'] = []

  for (let i = 0; i < count; i += 1) {
    const peeked = peekAddressesAtIndex(wallet, network, i)
    if (peeked.length === 0) {
      break
    }
    addresses.push(...peeked)
  }

  return addresses
}

function getWalletAddressesUsingStopGap(
  wallet: BdkWallet,
  network: Network,
  transactions: Transaction[],
  stopGap: number
): Account['addresses'] {
  const addresses: Account['addresses'] = []
  const seenAddresses: Record<string, boolean> = {}

  for (const tx of transactions) {
    for (const output of tx.vout) {
      seenAddresses[output.address] = true
    }
  }

  let lastIndexWithFunds = -1

  for (let i = 0; i < lastIndexWithFunds + stopGap; i += 1) {
    const peeked = peekAddressesAtIndex(wallet, network, i)
    if (peeked.length === 0) {
      break
    }
    addresses.push(...peeked)

    if (peeked.some(({ address }) => seenAddresses[address] !== undefined)) {
      lastIndexWithFunds = i
    }
  }

  return addresses
}

function getWalletOverview(
  wallet: BdkWallet,
  network: Network,
  stopGap = 10
): Pick<Account, 'transactions' | 'utxos' | 'addresses' | 'summary'> {
  if (!wallet) {
    return {
      addresses: [],
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      },
      transactions: [],
      utxos: []
    }
  }

  const balance = wallet.getBalance()
  const localOutputs = wallet.listUnspent()
  const txDetailsList = wallet.transactions()

  const transactions: Transaction[] = txDetailsList.map((txDetails) =>
    parseTxDetailsToTransaction(txDetails, localOutputs, network, wallet)
  )

  const utxos: Utxo[] = localOutputs.map((localOutput) =>
    parseLocalOutputToUtxo(localOutput, txDetailsList, network)
  )

  let addresses = getWalletAddressesUsingStopGap(
    wallet,
    network,
    transactions,
    stopGap
  )

  addresses = ensureAddressesIncludeSeenOutputs(
    wallet,
    toAppNetwork(network),
    addresses,
    collectTransactionOutputAddresses(transactions)
  )

  const ownedTransactions = annotateTransactionsWithWalletOwnership(
    transactions,
    addresses,
    utxos
  )

  addresses = parseAccountAddressesDetails({
    addresses,
    keys: [{ scriptVersion: undefined }],
    transactions: ownedTransactions,
    utxos
  })

  const seenAddress: Record<string, boolean> = {}
  for (const tx of ownedTransactions) {
    for (const output of tx.vout) {
      if (output.address) {
        seenAddress[output.address] = true
      }
    }
  }

  let numberOfAddresses = 0
  for (const address of addresses) {
    if (address.keychain === 'external' && seenAddress[address.address]) {
      numberOfAddresses += 1
    }
  }

  return {
    addresses,
    summary: {
      balance: balance.confirmed,
      numberOfAddresses,
      numberOfTransactions: txDetailsList.length,
      numberOfUtxos: localOutputs.length,
      satsInMempool: balance.trustedPending + balance.untrustedPending
    },
    transactions: ownedTransactions,
    utxos
  }
}

function parseTxDetailsToTransaction(
  txDetails: TxDetailsN,
  utxos: LocalOutputN[],
  network: Network,
  wallet: BdkWallet
): Transaction {
  let address = ''
  const utxo = utxos.find((utxo) => utxo?.outpoint?.txid === txDetails.txid)
  if (utxo) {
    try {
      address = addressFromScript(utxo.txout.scriptPubkeyHex, network)
    } catch {
      // Non-standard scripts can't be converted to addresses
    }
  }

  const {
    txid,
    sent,
    received,
    fee,
    confirmationBlockTime,
    version,
    locktime,
    inputs,
    outputs
  } = txDetails

  const txHex = wallet.getTx(txid)
  const raw = txHex ? [...hex.decode(txHex)] : []

  const vin: Transaction['vin'] = inputs.map((input) => ({
    previousOutput: {
      txid: input.previousTxid,
      vout: input.previousVout
    },
    scriptSig: [...hex.decode(input.scriptSigHex)],
    sequence: input.sequence,
    witness: input.witness.map((w) => [...hex.decode(w)])
  }))

  const vout: Transaction['vout'] = outputs.map((output) => ({
    address: output.address || '',
    script: [...hex.decode(output.scriptPubkeyHex)],
    value: output.value
  }))

  const { size, vsize, weight } = getRawTransactionSizes(txHex ?? '')

  return {
    address,
    blockHeight: confirmationBlockTime?.height,
    fee,
    id: txid,
    label: '',
    lockTime: locktime,
    lockTimeEnabled: locktime > 0,
    prices: {},
    raw,
    received,
    sent,
    size,
    timestamp: confirmationBlockTime?.timestamp
      ? new Date(confirmationBlockTime.timestamp * MS_PER_SECOND)
      : undefined,
    type: sent ? 'send' : 'receive',
    version,
    vin,
    vout,
    vsize,
    weight
  }
}

function parseLocalOutputToUtxo(
  localOutput: LocalOutputN,
  txDetailsList: TxDetailsN[],
  network: Network
): Utxo {
  let addressTo = ''
  try {
    addressTo = addressFromScript(localOutput.txout.scriptPubkeyHex, network)
  } catch {
    // Non-standard scripts
  }
  const transactionId = localOutput.outpoint.txid
  const txDetails = txDetailsList.find((td) => td.txid === transactionId)
  const script = [...hex.decode(localOutput.txout.scriptPubkeyHex)]

  return {
    addressTo,
    keychain: 'external',
    label: '',
    script,
    timestamp: txDetails?.confirmationBlockTime?.timestamp
      ? new Date(txDetails.confirmationBlockTime.timestamp * MS_PER_SECOND)
      : undefined,
    txid: transactionId,
    value: localOutput.txout.value,
    vout: localOutput.outpoint.vout
  }
}

export {
  appendAddressAtIndex,
  getWalletAddresses,
  getWalletOverview,
  maxCoreKeychainIndex,
  revealKnownAddresses,
  toAppNetwork
}
