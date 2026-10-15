import { hex } from '@scure/base'
import {
  addressFromScript,
  type BdkWallet,
  KeychainKind,
  type LocalOutputN,
  type Network,
  type TxDetailsN
} from 'react-native-bdk-sdk'

import { WITNESS_SCALE_FACTOR } from '@/constants/btc'
import { MS_PER_SECOND } from '@/constants/time'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Network as BlockchainNetwork } from '@/types/settings/blockchain'
import { parseAccountAddressesDetails } from '@/utils/parse'
import {
  annotateTransactionsWithWalletOwnership,
  collectTransactionOutputAddresses,
  ensureAddressesIncludeSeenOutputs
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
    wallet.revealNextAddress(keychainKind)
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

function getWalletAddresses(
  wallet: BdkWallet,
  network: Network,
  count = 10
): Account['addresses'] {
  const addresses: Account['addresses'] = []

  for (let i = 0; i < count; i += 1) {
    const receiveAddrInfo = wallet.peekAddress(KeychainKind.External, i)
    addresses.push({
      address: receiveAddrInfo.address,
      index: i,
      keychain: 'external',
      label: '',
      network: toAppNetwork(network),
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    })

    const changeAddrInfo = wallet.peekAddress(KeychainKind.Internal, i)
    addresses.push({
      address: changeAddrInfo.address,
      index: i,
      keychain: 'internal',
      label: '',
      network: toAppNetwork(network),
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    })
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
    const receiveAddr = wallet.peekAddress(KeychainKind.External, i).address
    addresses.push({
      address: receiveAddr,
      index: i,
      keychain: 'external',
      label: '',
      network: toAppNetwork(network),
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    })

    if (seenAddresses[receiveAddr] !== undefined) {
      lastIndexWithFunds = i
    }

    const changeAddr = wallet.peekAddress(KeychainKind.Internal, i).address
    addresses.push({
      address: changeAddr,
      index: i,
      keychain: 'internal',
      label: '',
      network: toAppNetwork(network),
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    })

    if (seenAddresses[changeAddr] !== undefined && i > lastIndexWithFunds) {
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
  const raw = txHex ? Array.from(hex.decode(txHex)) : []

  const vin: Transaction['vin'] = inputs.map((input) => ({
    previousOutput: {
      txid: input.previousTxid,
      vout: input.previousVout
    },
    scriptSig: Array.from(hex.decode(input.scriptSigHex)),
    sequence: input.sequence,
    witness: input.witness.map((w) => Array.from(hex.decode(w)))
  }))

  const vout: Transaction['vout'] = outputs.map((output) => ({
    address: output.address || '',
    script: Array.from(hex.decode(output.scriptPubkeyHex)),
    value: output.value
  }))

  let size = 0
  let vsize = 0
  let weight = 0
  if (raw.length) {
    size = raw.length
    weight = size * WITNESS_SCALE_FACTOR
    vsize = Math.ceil(weight / WITNESS_SCALE_FACTOR)
  }

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
  const script = Array.from(hex.decode(localOutput.txout.scriptPubkeyHex))

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
