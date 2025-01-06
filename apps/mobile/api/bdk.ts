import {
  Address,
  Blockchain,
  DatabaseConfig,
  Descriptor,
  DescriptorSecretKey,
  Mnemonic,
  Wallet
} from 'bdk-rn'
import { LocalUtxo, TransactionDetails } from 'bdk-rn/lib/classes/Bindings'
import {
  AddressIndex,
  BlockchainElectrumConfig,
  BlockchainEsploraConfig,
  BlockChainNames,
  KeychainKind,
  Network
} from 'bdk-rn/lib/lib/enums'

import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { Backend } from '@/types/settings/blockchain'

async function generateMnemonic(count: NonNullable<Account['seedWordCount']>) {
  const mnemonic = await new Mnemonic().create(count)
  return mnemonic.asString().split(' ')
}

async function validateMnemonic(seedWords: NonNullable<Account['seedWords']>) {
  try {
    await new Mnemonic().fromString(seedWords.join(' '))
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
  const mnemonic = await new Mnemonic().fromString(seedWords.join(' '))
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
  const mnemonic = await new Mnemonic().fromString(seedWords.join(' '))
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
  internalDescriptor: Descriptor,
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
  if (utxo) {
    address = await getAddress(utxo, network)
  }

  const { transaction } = transactionDetails

  let size = 0
  const vout: Transaction['vout'] = []

  if (transaction) {
    size = await transaction.size()
    const outputs = await transaction.output()
    for (const index in outputs) {
      const { value, script } = outputs[index]
      const addressObj = await new Address().fromScript(script, network)
      const address = await addressObj.asString()
      vout.push({ value, address })
    }
  }

  return {
    id: transactionDetails.txid,
    type: transactionDetails.sent ? 'send' : 'receive',
    sent: transactionDetails.sent,
    received: transactionDetails.received,
    timestamp: transactionDetails.confirmationTime?.timestamp
      ? new Date(transactionDetails.confirmationTime.timestamp * 1000)
      : undefined,
    blockHeight: transactionDetails.confirmationTime?.height,
    memo: undefined,
    address,
    size,
    vout
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

  return {
    txid: transactionId,
    vout: localUtxo?.outpoint.vout,
    value: localUtxo?.txout.value,
    timestamp: transactionDetails?.confirmationTime?.timestamp
      ? new Date(transactionDetails.confirmationTime.timestamp * 1000)
      : undefined,
    label: '',
    addressTo,
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

export {
  generateMnemonic,
  getBlockchain,
  getDescriptor,
  getFingerprint,
  getWalletData,
  getWalletFromDescriptor,
  getWalletFromMnemonic,
  parseDescriptor,
  syncWallet,
  validateMnemonic
}
