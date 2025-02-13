import {
  Address,
  Blockchain,
  DatabaseConfig,
  Descriptor,
  DescriptorSecretKey,
  Mnemonic,
  type PartiallySignedTransaction,
  TxBuilder,
  Wallet
} from 'bdk-rn'
import {
  type LocalUtxo,
  type TransactionDetails,
  type TxBuilderResult
} from 'bdk-rn/lib/classes/Bindings'
import {
  AddressIndex,
  type BlockchainElectrumConfig,
  type BlockchainEsploraConfig,
  BlockChainNames,
  KeychainKind,
  type Network
} from 'bdk-rn/lib/lib/enums'

import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type Backend } from '@/types/settings/blockchain'

async function generateMnemonic(count: NonNullable<Account['seedWordCount']>) {
  const mnemonic = await new Mnemonic().create(count)
  return mnemonic.asString()
}

async function validateMnemonic(seedWords: NonNullable<Account['seedWords']>) {
  try {
    await new Mnemonic().fromString(seedWords)
  } catch (_) {
    return false
  }
  return true
}

async function getDescriptor(
  seedWords: NonNullable<Account['seedWords']>,
  scriptVersion: NonNullable<Account['scriptVersion']>,
  kind: KeychainKind,
  passphrase: Account['passphrase'],
  network: Network
) {
  const mnemonic = await new Mnemonic().fromString(seedWords)
  const descriptorSecretKey = await new DescriptorSecretKey().create(
    network,
    mnemonic,
    passphrase
  )

  switch (scriptVersion) {
    case 'P2PKH':
      return new Descriptor().newBip44(descriptorSecretKey, kind, network)
    case 'P2SH-P2WPKH':
      return new Descriptor().newBip49(descriptorSecretKey, kind, network)
    case 'P2WPKH':
      return new Descriptor().newBip84(descriptorSecretKey, kind, network)
    case 'P2TR':
      return new Descriptor().newBip86(descriptorSecretKey, kind, network)
  }
}

async function parseDescriptor(descriptor: Descriptor) {
  const descriptorString = await descriptor.asString()
  const match = descriptorString.match(/\[([0-9a-f]+)([0-9'/]+)\]/)

  return match
    ? { fingerprint: match[1], derivationPath: `m${match[2]}` }
    : { fingerprint: '', derivationPath: '' }
}

async function getFingerprint(
  seedWords: NonNullable<Account['seedWords']>,
  passphrase: Account['passphrase'],
  network: Network
) {
  const mnemonic = await new Mnemonic().fromString(seedWords)
  const descriptorSecretKey = await new DescriptorSecretKey().create(
    network,
    mnemonic,
    passphrase
  )
  const descriptor = await new Descriptor().newBip84(
    descriptorSecretKey,
    KeychainKind.External,
    network
  )

  const { fingerprint } = await parseDescriptor(descriptor)
  return fingerprint
}

async function getWalletFromMnemonic(
  seedWords: NonNullable<Account['seedWords']>,
  scriptVersion: NonNullable<Account['scriptVersion']>,
  passphrase: Account['passphrase'],
  network: Network
) {
  const [externalDescriptor, internalDescriptor] = await Promise.all([
    getDescriptor(
      seedWords,
      scriptVersion,
      KeychainKind.External,
      passphrase,
      network
    ),
    getDescriptor(
      seedWords,
      scriptVersion,
      KeychainKind.Internal,
      passphrase,
      network
    )
  ])

  const [{ fingerprint, derivationPath }, wallet] = await Promise.all([
    parseDescriptor(externalDescriptor),
    getWalletFromDescriptor(externalDescriptor, internalDescriptor, network)
  ])

  return {
    fingerprint,
    derivationPath,
    externalDescriptor: await externalDescriptor.asString(),
    internalDescriptor: await internalDescriptor.asString(),
    wallet
  }
}

async function getWalletFromDescriptor(
  externalDescriptor: Descriptor,
  internalDescriptor: Descriptor | null | undefined,
  network: Network
) {
  const dbConfig = await new DatabaseConfig().memory()
  const wallet = await new Wallet().create(
    externalDescriptor,
    internalDescriptor,
    network,
    dbConfig
  )

  return wallet
}

async function getBlockchain(
  backend: Backend,
  config: BlockchainElectrumConfig | BlockchainEsploraConfig
) {
  const blockchainName: BlockChainNames =
    backend === 'electrum' ? BlockChainNames.Electrum : BlockChainNames.Esplora

  const blockchain = await new Blockchain().create(config, blockchainName)
  return blockchain
}

async function syncWallet(
  wallet: Wallet,
  backend: Backend,
  blockchainConfig: BlockchainElectrumConfig | BlockchainEsploraConfig
) {
  const blockchain = await getBlockchain(backend, blockchainConfig)
  await wallet.sync(blockchain)
}

async function getAddress(utxo: LocalUtxo, network: Network) {
  const script = utxo.txout.script
  const address = await new Address().fromScript(script, network)
  return address.asString()
}

async function parseTransactionDetailsToTransaction(
  transactionDetails: TransactionDetails,
  utxos: LocalUtxo[],
  network: Network
): Promise<Transaction> {
  const transactionUtxos = utxos.filter(
    (utxo) => utxo?.outpoint?.txid === transactionDetails.txid
  )

  let address = ''
  const utxo = transactionUtxos?.[0]
  if (utxo) address = await getAddress(utxo, network)

  const { confirmationTime, fee, received, sent, transaction, txid } =
    transactionDetails

  let lockTimeEnabled = false
  let lockTime = 0
  let size = 0
  let version = 0
  let vsize = 0
  let weight = 0
  let raw: number[] = []
  const vin: Transaction['vin'] = []
  const vout: Transaction['vout'] = []

  if (transaction) {
    size = await transaction.size()
    vsize = await transaction.vsize()
    weight = await transaction.weight()
    version = await transaction.version()
    lockTime = await transaction.lockTime()
    lockTimeEnabled = await transaction.isLockTimeEnabled()
    raw = await transaction.serialize()

    const inputs = await transaction.input()
    const outputs = await transaction.output()

    for (const index in inputs) {
      const input = inputs[index]
      const script = await input.scriptSig.toBytes()
      input.scriptSig = script
      vin.push(input)
    }

    for (const index in outputs) {
      const { value, script: scriptObj } = outputs[index]
      const script = await scriptObj.toBytes()
      const addressObj = await new Address().fromScript(scriptObj, network)
      const address = await addressObj.asString()
      vout.push({ value, address, script })
    }
  }

  return {
    id: txid,
    type: sent ? 'send' : 'receive',
    sent,
    received,
    label: '',
    fee,
    prices: {},
    timestamp: confirmationTime?.timestamp
      ? new Date(confirmationTime.timestamp * 1000)
      : undefined,
    blockHeight: confirmationTime?.height,
    address,
    size,
    vsize,
    vout,
    version,
    weight,
    lockTime,
    lockTimeEnabled,
    raw,
    vin
  }
}

async function parseLocalUtxoToUtxo(
  localUtxo: LocalUtxo,
  transactionsDetails: TransactionDetails[],
  network: Network
): Promise<Utxo> {
  const addressTo = await getAddress(localUtxo, network)
  const transactionId = localUtxo?.outpoint.txid
  const transactionDetails = transactionsDetails.find(
    (transactionDetails) => transactionDetails.txid === transactionId
  )
  const script = await localUtxo.txout.script.toBytes()

  return {
    txid: transactionId,
    vout: localUtxo?.outpoint.vout,
    value: localUtxo?.txout.value,
    timestamp: transactionDetails?.confirmationTime?.timestamp
      ? new Date(transactionDetails.confirmationTime.timestamp * 1000)
      : undefined,
    label: '',
    addressTo,
    script,
    keychain: 'external'
  }
}

async function getWalletData(
  wallet: Wallet,
  netWork: Network
): Promise<Pick<Account, 'transactions' | 'utxos' | 'summary'>> {
  if (wallet) {
    const [balance, addressInfo, transactionsDetails, localUtxos] =
      await Promise.all([
        wallet.getBalance(),
        wallet.getAddress(AddressIndex.New),
        wallet.listTransactions(true),
        wallet.listUnspent()
      ])

    const transactions = await Promise.all(
      (transactionsDetails || []).map((transactionDetails) =>
        parseTransactionDetailsToTransaction(
          transactionDetails,
          localUtxos,
          netWork
        )
      )
    )

    const utxos = await Promise.all(
      (localUtxos || []).map((localUtxo) =>
        parseLocalUtxoToUtxo(localUtxo, transactionsDetails, netWork)
      )
    )

    return {
      transactions,
      utxos,
      summary: {
        balance: balance.confirmed,
        numberOfAddresses: addressInfo.index + 1,
        numberOfTransactions: transactionsDetails.length,
        numberOfUtxos: localUtxos.length,
        satsInMempool: balance.trustedPending + balance.untrustedPending
      }
    }
  } else {
    return {
      transactions: [],
      utxos: [],
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      }
    }
  }
}

async function getLastUnusedWalletAddress(
  wallet: Wallet,
  addressIndex: number
) {
  const newAddress = await wallet.getAddress(addressIndex)

  return newAddress
}

async function buildTransaction(
  wallet: Wallet,
  utxos: Utxo[],
  recipient: string,
  amount: number,
  fee: number
) {
  const address = await new Address().create(recipient)
  const script = await address.scriptPubKey()

  const transactionBuilder = await new TxBuilder().create()

  await transactionBuilder.feeAbsolute(fee)
  await transactionBuilder.addUtxos(
    utxos.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout }))
  )
  await transactionBuilder.manuallySelectedOnly()
  await transactionBuilder.addRecipient(script, amount)

  const transactionBuilderResult = await transactionBuilder.finish(wallet)
  return transactionBuilderResult
}

async function signTransaction(transaction: TxBuilderResult, wallet: Wallet) {
  const partiallySignedTransaction = await wallet.sign(transaction.psbt)
  return partiallySignedTransaction
}

async function broadcastTransaction(
  psbt: PartiallySignedTransaction,
  blockchain: Blockchain
) {
  const transaction = await psbt.extractTx()

  const result = await blockchain.broadcast(transaction)
  return result
}

export {
  broadcastTransaction,
  buildTransaction,
  generateMnemonic,
  getBlockchain,
  getDescriptor,
  getFingerprint,
  getLastUnusedWalletAddress,
  getWalletData,
  getWalletFromDescriptor,
  getWalletFromMnemonic,
  parseDescriptor,
  signTransaction,
  syncWallet,
  validateMnemonic
}
