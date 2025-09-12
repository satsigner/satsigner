import {
  Address,
  Blockchain,
  DatabaseConfig,
  Descriptor,
  DescriptorPublicKey,
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
  Network
} from 'bdk-rn/lib/lib/enums'

import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  type Backend,
  type Network as BlockchainNetwork
} from '@/types/settings/blockchain'
import { getDerivationPathFromScriptVersion } from '@/utils/bitcoin'
import { parseAccountAddressesDetails } from '@/utils/parse'

import ElectrumClient from './electrum'
import Esplora from './esplora'

type WalletData = {
  fingerprint: string
  derivationPath: string
  externalDescriptor: string
  internalDescriptor: string
  wallet: Wallet
  keyFingerprints?: string[] // Optional for multisig accounts
}

async function generateMnemonic(
  mnemonicWordCount: NonNullable<Key['mnemonicWordCount']>
) {
  const mnemonic = await new Mnemonic().create(mnemonicWordCount)
  return mnemonic ? mnemonic.asString() : ''
}

async function generateMnemonicFromEntropy(entropy: string) {
  if (entropy.length < 128 || entropy.length > 256)
    throw new Error(
      'Invalid Entropy: Entropy length must be range of [128, 256]'
    )

  if (entropy.length % 32 !== 0)
    throw new Error('Invalid Entropy: Entropy length must be divide by 32')

  const bytes = entropy.match(/.{1,8}/g)?.map((b) => parseInt(b, 2)) ?? []

  const numbers = Array.from(new Uint8Array(bytes))
  const mnemonic = await new Mnemonic().fromEntropy(numbers)
  return mnemonic ? mnemonic.asString() : ''
}

async function validateMnemonic(mnemonic: NonNullable<Secret['mnemonic']>) {
  try {
    await new Mnemonic().fromString(mnemonic)
  } catch (_) {
    return false
  }
  return true
}

async function extractFingerprintFromExtendedPublicKey(
  extendedPublicKey: string,
  network: Network
): Promise<string> {
  try {
    // Create a descriptor from the extended public key to extract fingerprint
    const descriptorString = `pkh(${extendedPublicKey})`
    const descriptor = await new Descriptor().create(descriptorString, network)
    if (!descriptor) {
      return ''
    }
    const parsedDescriptor = await parseDescriptor(descriptor)
    return parsedDescriptor.fingerprint
  } catch (_error) {
    return ''
  }
}

async function getWalletData(
  account: Account,
  network: Network
): Promise<WalletData | undefined> {
  switch (account.policyType) {
    case 'singlesig': {
      if (account.keys.length !== 1)
        throw new Error('Invalid key count for singlesig')

      const key = account.keys[0]

      if (
        key.creationType === 'generateMnemonic' ||
        key.creationType === 'importMnemonic'
      ) {
        if (
          typeof key.secret === 'string' ||
          !key.secret.mnemonic ||
          !key.scriptVersion
        )
          throw new Error('Invalid secret')

        const walletData = await getWalletFromMnemonic(
          key.secret.mnemonic,
          key.scriptVersion,
          key.secret.passphrase,
          network
        )

        return walletData
      } else if (key.creationType === 'importDescriptor') {
        // TODO
      }
      break
    }
    case 'multisig': {
      const extendedPublicKeys = await Promise.all(
        account.keys.map(async (key) => {
          if (typeof key.secret === 'object') {
            // If we have an extended public key directly, use it
            if (key.secret.extendedPublicKey) {
              return key.secret.extendedPublicKey
            }

            // If we have a descriptor, extract the extended public key from it
            if (key.secret.externalDescriptor) {
              try {
                const descriptor = await new Descriptor().create(
                  key.secret.externalDescriptor,
                  network
                )
                if (!descriptor) {
                  return null
                }
                const extendedKey =
                  await extractExtendedKeyFromDescriptor(descriptor)
                return extendedKey
              } catch (_error) {
                return null
              }
            }
          }
          return null
        })
      )

      const validExtendedPublicKeys = extendedPublicKeys.filter(
        (x): x is string => x !== null
      )

      if (validExtendedPublicKeys.length !== account.keys.length) {
        throw new Error('Failed to extract extended public keys from all keys')
      }

      // Extract fingerprints for each individual key
      const keyFingerprints = await Promise.all(
        validExtendedPublicKeys.map(async (extendedPublicKey) => {
          return await extractFingerprintFromExtendedPublicKey(
            extendedPublicKey,
            network
          )
        })
      )

      const multisigDescriptorString = `wsh(multi(${
        account.keysRequired
      },${validExtendedPublicKeys.join(',')}))`
      const multisigDescriptor = await new Descriptor().create(
        multisigDescriptorString,
        network
      )
      if (!multisigDescriptor) {
        throw new Error('Failed to create multisig descriptor')
      }

      const parsedDescriptor = await parseDescriptor(multisigDescriptor)
      const wallet = await getWalletFromDescriptor(
        multisigDescriptor,
        null,
        network
      )

      return {
        fingerprint: parsedDescriptor.fingerprint,
        derivationPath: parsedDescriptor.derivationPath,
        externalDescriptor: multisigDescriptorString,
        internalDescriptor: '',
        wallet,
        keyFingerprints // Add individual key fingerprints
      }
    }
    case 'watchonly': {
      if (account.keys.length !== 1)
        throw new Error('Invalid key count for singlesig')

      const key = account.keys[0]

      if (key.creationType === 'importDescriptor') {
        if (typeof key.secret === 'string' || !key.secret.externalDescriptor)
          throw new Error('Invalid secret')

        const externalDescriptor = await new Descriptor().create(
          key.secret.externalDescriptor,
          network
        )
        if (!externalDescriptor) {
          throw new Error('Failed to create external descriptor')
        }
        const internalDescriptor = key.secret.internalDescriptor
          ? await new Descriptor().create(
              key.secret.internalDescriptor,
              network
            )
          : null
        if (key.secret.internalDescriptor && !internalDescriptor) {
          throw new Error('Failed to create internal descriptor')
        }

        const parsedDescriptor = await parseDescriptor(externalDescriptor)
        const wallet = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          fingerprint: parsedDescriptor.fingerprint,
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor: externalDescriptor
            ? await externalDescriptor.asString()
            : '',
          internalDescriptor: internalDescriptor
            ? await internalDescriptor.asString()
            : '',
          wallet
        }
      } else if (key.creationType === 'importExtendedPub') {
        if (
          !key.scriptVersion ||
          !key.fingerprint ||
          typeof key.secret === 'string' ||
          !key.secret.extendedPublicKey
        )
          throw new Error('Invalid account information')

        const extendedPublicKey = await new DescriptorPublicKey().fromString(
          key.secret.extendedPublicKey
        )

        let externalDescriptor: Descriptor
        let internalDescriptor: Descriptor

        switch (key.scriptVersion) {
          case 'P2PKH':
            externalDescriptor = await new Descriptor().newBip44Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip44Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2SH-P2WPKH':
            externalDescriptor = await new Descriptor().newBip49Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip49Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2WPKH':
            externalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2TR':
            externalDescriptor = await new Descriptor().newBip86Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip86Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2WSH':
          case 'P2SH-P2WSH':
          case 'Legacy P2SH':
            // For multisig script types, we need to create descriptors manually
            throw new Error(
              `Manual descriptor creation required for ${key.scriptVersion}`
            )
          default:
            externalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
        }

        const parsedDescriptor = await parseDescriptor(externalDescriptor)
        const wallet = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          fingerprint: parsedDescriptor.fingerprint,
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor: externalDescriptor
            ? await externalDescriptor.asString()
            : '',
          internalDescriptor: internalDescriptor
            ? await internalDescriptor.asString()
            : '',
          wallet
        }
      } else if (key.creationType === 'importAddress') {
        // BDK does not support address descriptor
      }

      break
    }
  }
}

async function getWalletFromMnemonic(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  passphrase: Secret['passphrase'],
  network: Network
) {
  let externalDescriptor: Descriptor
  let internalDescriptor: Descriptor

  try {
    externalDescriptor = await getDescriptor(
      mnemonic,
      scriptVersion,
      KeychainKind.External,
      passphrase,
      network
    )

    internalDescriptor = await getDescriptor(
      mnemonic,
      scriptVersion,
      KeychainKind.Internal,
      passphrase,
      network
    )
  } catch (error) {
    // Handle manual descriptor creation for multisig script types
    if (
      error instanceof Error &&
      error.message.includes('Manual descriptor creation required')
    ) {
      // For multisig script types, we need to create descriptors manually
      const parsedMnemonic = await new Mnemonic().fromString(mnemonic)
      const descriptorSecretKey = await new DescriptorSecretKey().create(
        network,
        parsedMnemonic,
        passphrase
      )

      // Create descriptors using the existing BDK methods for basic derivation
      // and then manually construct the multisig descriptors
      const baseExternalDescriptor = await new Descriptor().newBip84(
        descriptorSecretKey,
        KeychainKind.External,
        network
      )
      const baseInternalDescriptor = await new Descriptor().newBip84(
        descriptorSecretKey,
        KeychainKind.Internal,
        network
      )

      // Get the base descriptor strings
      const baseExternalString = baseExternalDescriptor
        ? await baseExternalDescriptor.asString()
        : ''
      const baseInternalString = baseInternalDescriptor
        ? await baseInternalDescriptor.asString()
        : ''

      // Extract the key part (everything after the script function)
      const externalKeyPart = baseExternalString
        .replace(/^wpkh\(/, '')
        .replace(/\)$/, '')
      const internalKeyPart = baseInternalString
        .replace(/^wpkh\(/, '')
        .replace(/\)$/, '')

      // Create multisig descriptor strings based on script version
      let externalDescriptorString = ''
      let internalDescriptorString = ''

      switch (scriptVersion) {
        case 'P2WSH':
          externalDescriptorString = `wsh(${externalKeyPart})`
          internalDescriptorString = `wsh(${internalKeyPart})`
          break
        case 'P2SH-P2WSH':
          externalDescriptorString = `sh(wsh(${externalKeyPart}))`
          internalDescriptorString = `sh(wsh(${internalKeyPart}))`
          break
        case 'Legacy P2SH':
          externalDescriptorString = `sh(${externalKeyPart})`
          internalDescriptorString = `sh(${internalKeyPart})`
          break
        default:
          throw new Error(`Unsupported script version: ${scriptVersion}`)
      }

      // Create descriptors using BDK
      externalDescriptor = await new Descriptor().create(
        externalDescriptorString,
        network
      )
      internalDescriptor = await new Descriptor().create(
        internalDescriptorString,
        network
      )
    } else {
      throw error
    }
  }

  // Ensure variables are assigned
  if (!externalDescriptor || !internalDescriptor) {
    throw new Error('Failed to create descriptors')
  }

  // TO DO: Try Promise.all() method instead Sequential one.
  const [{ fingerprint, derivationPath }, wallet] = await Promise.all([
    parseDescriptor(externalDescriptor),
    getWalletFromDescriptor(externalDescriptor, internalDescriptor, network)
  ])

  return {
    fingerprint,
    derivationPath,
    externalDescriptor: externalDescriptor
      ? await externalDescriptor.asString()
      : '',
    internalDescriptor: internalDescriptor
      ? await internalDescriptor.asString()
      : '',
    wallet
  }
}

async function getDescriptor(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  kind: KeychainKind,
  passphrase: Secret['passphrase'],
  network: Network
) {
  const parsedMnemonic = await new Mnemonic().fromString(mnemonic)
  const descriptorSecretKey = await new DescriptorSecretKey().create(
    network,
    parsedMnemonic,
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
    case 'P2WSH':
    case 'P2SH-P2WSH':
    case 'Legacy P2SH':
      // For multisig script types, we need to create descriptors manually
      // since BDK doesn't have specific methods for these
      throw new Error(
        `Manual descriptor creation required for ${scriptVersion}`
      )
    default:
      return new Descriptor().newBip84(descriptorSecretKey, kind, network)
  }
}

async function parseDescriptor(descriptor: Descriptor) {
  if (!descriptor) {
    return { fingerprint: '', derivationPath: '' }
  }
  const descriptorString = await descriptor.asString()
  const match = descriptorString.match(/\[([0-9a-f]+)([0-9'/]+)\]/)
  return match
    ? { fingerprint: match[1], derivationPath: `m${match[2]}` }
    : { fingerprint: '', derivationPath: '' }
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

async function extractExtendedKeyFromDescriptor(descriptor: Descriptor) {
  if (!descriptor) {
    return ''
  }
  const descriptorString = await descriptor.asString()
  const match = descriptorString.match(/(tpub|xpub|vpub|zpub)[A-Za-z0-9]+/)
  return match ? match[0] : ''
}

async function getExtendedPublicKeyFromAccountKey(key: Key, network: Network) {
  if (typeof key.secret === 'string') return
  if (!key.secret.mnemonic || !key.scriptVersion) return

  const externalDescriptor = await getDescriptor(
    key.secret.mnemonic,
    key.scriptVersion,
    KeychainKind.External,
    key.secret.passphrase,
    network
  )
  const extendedKey = await extractExtendedKeyFromDescriptor(externalDescriptor)

  return extendedKey
}

async function getDescriptorsFromKeyData(
  extendedPublicKey: string,
  fingerprint: string,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  network: Network
) {
  // Convert BDK Network to blockchain Network type
  const blockchainNetwork =
    network === Network.Bitcoin
      ? 'bitcoin'
      : network === Network.Testnet
        ? 'testnet'
        : 'signet'

  const derivationPath = getDerivationPathFromScriptVersion(
    scriptVersion,
    blockchainNetwork
  )

  // Construct the key part with fingerprint and derivation path
  const keyPart = `[${fingerprint}/${derivationPath}]${extendedPublicKey}`

  let externalDescriptor = ''
  let internalDescriptor = ''

  // Generate descriptors based on script version
  switch (scriptVersion) {
    case 'P2PKH':
      externalDescriptor = `pkh(${keyPart}/0/*)`
      internalDescriptor = `pkh(${keyPart}/1/*)`
      break
    case 'P2SH-P2WPKH':
      externalDescriptor = `sh(wpkh(${keyPart}/0/*))`
      internalDescriptor = `sh(wpkh(${keyPart}/1/*))`
      break
    case 'P2WPKH':
      externalDescriptor = `wpkh(${keyPart}/0/*)`
      internalDescriptor = `wpkh(${keyPart}/1/*)`
      break
    case 'P2TR':
      externalDescriptor = `tr(${keyPart}/0/*)`
      internalDescriptor = `tr(${keyPart}/1/*)`
      break
    case 'P2WSH':
      externalDescriptor = `wsh(${keyPart}/0/*)`
      internalDescriptor = `wsh(${keyPart}/1/*)`
      break
    case 'P2SH-P2WSH':
      externalDescriptor = `sh(wsh(${keyPart}/0/*))`
      internalDescriptor = `sh(wsh(${keyPart}/1/*))`
      break
    case 'Legacy P2SH':
      externalDescriptor = `sh(${keyPart}/0/*)`
      internalDescriptor = `sh(${keyPart}/1/*)`
      break
    default:
      externalDescriptor = `wpkh(${keyPart}/0/*)`
      internalDescriptor = `wpkh(${keyPart}/1/*)`
  }

  // Add checksum using BDK
  try {
    const externalDesc = await new Descriptor().create(
      externalDescriptor,
      network
    )
    const internalDesc = await new Descriptor().create(
      internalDescriptor,
      network
    )

    return {
      externalDescriptor: externalDesc
        ? await externalDesc.asString()
        : externalDescriptor,
      internalDescriptor: internalDesc
        ? await internalDesc.asString()
        : internalDescriptor
    }
  } catch (_error) {
    // Return descriptors without checksum if BDK fails
    return {
      externalDescriptor,
      internalDescriptor
    }
  }
}

async function syncWallet(
  wallet: Wallet,
  backend: Backend,
  blockchainConfig: BlockchainElectrumConfig | BlockchainEsploraConfig
) {
  const blockchain = await getBlockchain(backend, blockchainConfig)
  await wallet.sync(blockchain)
}

async function getBlockchain(
  backend: Backend,
  config: BlockchainElectrumConfig | BlockchainEsploraConfig
) {
  let blockchainName: BlockChainNames = BlockChainNames.Electrum
  if (backend === 'esplora') blockchainName = BlockChainNames.Esplora

  const blockchain = await new Blockchain().create(config, blockchainName)
  return blockchain
}

async function getWalletAddresses(
  wallet: Wallet,
  network: Network,
  count = 10
): Promise<Account['addresses']> {
  const addresses: Account['addresses'] = []

  for (let i = 0; i < count; i += 1) {
    const receiveAddrInfo = await wallet.getAddress(i)
    const receiveAddr = receiveAddrInfo?.address
      ? await receiveAddrInfo.address.asString()
      : ''
    addresses.push({
      address: receiveAddr,
      keychain: 'external',
      transactions: [],
      utxos: [],
      index: i,
      network: network as BlockchainNetwork,
      label: '',
      summary: {
        transactions: 0,
        utxos: 0,
        balance: 0,
        satsInMempool: 0
      }
    })

    const changeAddrInfo = await wallet.getInternalAddress(i)
    const changeAddr = changeAddrInfo?.address
      ? await changeAddrInfo.address.asString()
      : ''

    addresses.push({
      address: changeAddr,
      keychain: 'internal',
      transactions: [],
      utxos: [],
      index: i,
      network: network as BlockchainNetwork,
      label: '',
      summary: {
        transactions: 0,
        utxos: 0,
        balance: 0,
        satsInMempool: 0
      }
    })
  }

  return addresses
}

async function getWalletAddressesUsingStopGap(
  wallet: Wallet,
  network: Network,
  transactions: Transaction[],
  stopGap: number
): Promise<Account['addresses']> {
  const addresses: Account['addresses'] = []
  const seenAddresses: Record<string, boolean> = {}

  for (const tx of transactions) {
    for (const output of tx.vout) {
      seenAddresses[output.address] = true
    }
  }

  let lastIndexWithFunds = -1

  for (let i = 0; i < lastIndexWithFunds + stopGap; i += 1) {
    const receiveAddrInfo = await wallet.getAddress(i)
    const receiveAddr = receiveAddrInfo?.address
      ? await receiveAddrInfo.address.asString()
      : ''
    addresses.push({
      address: receiveAddr,
      keychain: 'external',
      transactions: [],
      utxos: [],
      index: i,
      network: network as BlockchainNetwork,
      label: '',
      summary: {
        transactions: 0,
        utxos: 0,
        balance: 0,
        satsInMempool: 0
      }
    })

    if (seenAddresses[receiveAddr] !== undefined) {
      lastIndexWithFunds = i
    }

    const changeAddrInfo = await wallet.getInternalAddress(i)
    const changeAddr = changeAddrInfo?.address
      ? await changeAddrInfo.address.asString()
      : ''

    addresses.push({
      address: changeAddr,
      keychain: 'internal',
      transactions: [],
      utxos: [],
      index: i,
      network: network as BlockchainNetwork,
      label: '',
      summary: {
        transactions: 0,
        utxos: 0,
        balance: 0,
        satsInMempool: 0
      }
    })
  }

  return addresses
}

async function getWalletOverview(
  wallet: Wallet,
  network: Network,
  stopGap = 10
): Promise<Pick<Account, 'transactions' | 'utxos' | 'addresses' | 'summary'>> {
  if (!wallet) {
    return {
      transactions: [],
      utxos: [],
      addresses: [],
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      }
    }
  }

  const [balance, _addressInfo, transactionsDetails, localUtxos] =
    await Promise.all([
      wallet.getBalance(),
      wallet.getAddress(AddressIndex.New),
      wallet.listTransactions(true),
      wallet.listUnspent()
    ])

  const transactions: Transaction[] = []
  for (const transactionDetails of transactionsDetails || []) {
    const tx = await parseTransactionDetailsToTransaction(
      transactionDetails,
      localUtxos,
      network
    )
    transactions.push(tx)
  }
  // TO DO: Try Promise.all() method instead Sequential one.

  const utxos: Utxo[] = []
  for (const localUtxo of localUtxos || []) {
    const utxo = await parseLocalUtxoToUtxo(
      localUtxo,
      transactionsDetails,
      network
    )
    utxos.push(utxo)
  }
  // TO DO: Try Promise.all() method instead Sequential one.

  let addresses = await getWalletAddressesUsingStopGap(
    wallet,
    network,
    transactions,
    stopGap
  )

  addresses = parseAccountAddressesDetails({
    transactions,
    utxos,
    addresses,
    keys: [
      {
        scriptVersion: undefined
      }
    ]
  } as Account)

  const seenAddress: Record<string, boolean> = {}
  for (const tx of transactions) {
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
    transactions,
    utxos,
    summary: {
      balance: balance.confirmed,
      numberOfAddresses,
      numberOfTransactions: transactionsDetails.length,
      numberOfUtxos: localUtxos.length,
      satsInMempool: balance.trustedPending + balance.untrustedPending
    }
  }
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
      const address = addressObj ? await addressObj.asString() : ''
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

async function getAddress(utxo: LocalUtxo, network: Network) {
  const script = utxo.txout.script
  const address = await new Address().fromScript(script, network)
  return address ? address.asString() : ''
}

async function getTransactionInputValues(
  tx: Transaction,
  backend: Backend,
  network: BlockchainNetwork,
  url: string
): Promise<Transaction['vin']> {
  if (!tx.vin.some((input) => input.value === undefined)) return tx.vin

  let vin: Transaction['vin'] = []

  if (backend === 'electrum') {
    const electrumClient = await ElectrumClient.initClientFromUrl(url, network)
    vin = await electrumClient.getTxInputValues(tx)
    electrumClient.close()
  }

  if (backend === 'esplora') {
    const esploraClient = new Esplora(url)
    vin = await esploraClient.getTxInputValues(tx.id)
  }

  return vin
}

async function getFingerprint(
  mnemonic: NonNullable<Secret['mnemonic']>,
  passphrase: Secret['passphrase'],
  network: Network
) {
  const bdkMnemonic = await new Mnemonic().fromString(mnemonic)
  const descriptorSecretKey = await new DescriptorSecretKey().create(
    network,
    bdkMnemonic,
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

async function getLastUnusedAddressFromWallet(wallet: Wallet) {
  const newAddress = await wallet.getAddress(AddressIndex.New)

  return newAddress
}

async function getScriptPubKeyFromAddress(address: string, network: Network) {
  const recipientAddress = await new Address().create(address, network)
  return recipientAddress.scriptPubKey()
}

async function buildTransaction(
  wallet: Wallet,
  data: {
    inputs: Utxo[]
    outputs: Output[]
    fee: number
    options: {
      rbf: boolean
    }
  },
  network: Network
) {
  const transactionBuilder = await new TxBuilder().create()

  await transactionBuilder.addUtxos(
    data.inputs.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout }))
  )
  await transactionBuilder.manuallySelectedOnly()

  for (const output of data.outputs) {
    const recipient = await getScriptPubKeyFromAddress(output.to, network)
    await transactionBuilder.addRecipient(recipient, output.amount)
  }

  await transactionBuilder.feeAbsolute(data.fee)

  if (data.options.rbf) await transactionBuilder.enableRbf()

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
  extractExtendedKeyFromDescriptor,
  extractFingerprintFromExtendedPublicKey,
  generateMnemonic,
  generateMnemonicFromEntropy,
  getBlockchain,
  getDescriptor,
  getDescriptorsFromKeyData,
  getExtendedPublicKeyFromAccountKey,
  getFingerprint,
  getLastUnusedAddressFromWallet,
  getTransactionInputValues,
  getWalletAddresses,
  getWalletData,
  getWalletFromDescriptor,
  getWalletFromMnemonic,
  getWalletOverview,
  parseDescriptor,
  signTransaction,
  syncWallet,
  validateMnemonic
}
