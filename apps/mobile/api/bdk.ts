import * as FileSystem from 'expo-file-system/legacy'
import {
  addressFromScript,
  BdkWallet,
  BdkTxBuilder,
  createPublicDescriptor,
  DescriptorTemplate,
  KeychainKind,
  type Network,
  type PsbtLike,
  type TxDetailsN,
  type LocalOutputN,
  walletNameFromDescriptor,
  type AddressInfo
} from 'react-native-bdk-sdk'

import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  type Backend,
  type Network as BlockchainNetwork
} from '@/types/settings/blockchain'
import {
  getExtendedKeyFromDescriptor,
  getFingerprintFromExtendedPublicKey
} from '@/utils/bip32'
import {
  detectElectrumSeed,
  getPrivateDescriptorFromElectrumMnemonic,
  getPrivateDescriptorFromMnemonic
} from '@/utils/bip39'
import {
  getMultisigDerivationPathFromScriptVersion,
  getMultisigScriptTypeFromScriptVersion
} from '@/utils/bitcoin'
import { parseAccountAddressesDetails } from '@/utils/parse'

import AppElectrumClient from './electrum'
import Esplora from './esplora'

// Map BDK Network enum to app's string network type
function toAppNetwork(network: Network): BlockchainNetwork {
  switch (network) {
    case 0:
      return 'bitcoin'
    case 2:
      return 'signet'
    default:
      return 'testnet'
  }
}

// Convert hex string to number array for compatibility with existing Transaction type
function hexToBytes(hex: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return bytes
}

const WALLETS_DIR = `${FileSystem.documentDirectory}wallets/`

async function ensureWalletsDir() {
  const dirInfo = await FileSystem.getInfoAsync(WALLETS_DIR)
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(WALLETS_DIR, { intermediates: true })
  }
}

// expo-file-system returns file:// URIs on Android, but Rust's SQLite
// expects a plain filesystem path. Strip the scheme if present.
function uriToPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri
}

async function getWalletDbPath(
  externalDescriptor: string,
  internalDescriptor: string | undefined,
  network: Network
): Promise<string> {
  await ensureWalletsDir()
  const name = walletNameFromDescriptor(
    externalDescriptor,
    internalDescriptor,
    network
  )
  return uriToPath(`${WALLETS_DIR}${name}.sqlite`)
}

type WalletData = {
  fingerprint: string
  derivationPath: string
  externalDescriptor: string
  internalDescriptor: string
  wallet: BdkWallet
  keyFingerprints?: string[] // Optional for multisig accounts
}

async function getWalletData(
  account: Account,
  network: Network
): Promise<WalletData | undefined> {
  switch (account.policyType) {
    case 'singlesig': {
      if (account.keys.length !== 1) {
        throw new Error('Invalid key count for singlesig')
      }

      const [key] = account.keys

      if (
        key.creationType === 'generateMnemonic' ||
        key.creationType === 'importMnemonic'
      ) {
        if (
          typeof key.secret === 'string' ||
          !key.secret.mnemonic ||
          !key.scriptVersion
        ) {
          throw new Error('Invalid secret')
        }

        const walletData = await getWalletDataFromMnemonic(
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
      // Get script version from the first key (all keys should have the same script version)
      const scriptVersion = account.keys[0]?.scriptVersion || 'P2WSH'
      const multisigScriptType =
        getMultisigScriptTypeFromScriptVersion(scriptVersion)

      // Extract key data with proper derivation paths and fingerprints
      const keyData = await Promise.all(
        account.keys.map((key, keyIndex) => {
          let extendedPublicKey = ''
          let fingerprint = ''

          if (typeof key.secret === 'object') {
            fingerprint =
              (typeof key.secret === 'object' && key.secret.fingerprint) ||
              key.fingerprint ||
              ''

            if (key.secret.extendedPublicKey) {
              ;({ extendedPublicKey } = key.secret)
            } else if (key.secret.externalDescriptor) {
              try {
                const extractedKey = getExtendedKeyFromDescriptor(
                  key.secret.externalDescriptor
                )
                if (extractedKey) {
                  extendedPublicKey = extractedKey
                }
              } catch {
                // Failed to extract extended public key
              }
            }
          }

          if (!fingerprint && extendedPublicKey) {
            fingerprint = getFingerprintFromExtendedPublicKey(extendedPublicKey)
          }

          return { extendedPublicKey, fingerprint, index: keyIndex }
        })
      )

      const validKeyData = keyData.filter(
        (
          kd
        ): kd is {
          fingerprint: string
          extendedPublicKey: string
          index: number
        } =>
          kd !== null &&
          kd.fingerprint !== undefined &&
          kd.extendedPublicKey !== undefined
      )

      if (validKeyData.length !== account.keys.length) {
        throw new Error(
          `Failed to extract extended public keys from all keys (${validKeyData.length}/${account.keys.length})`
        )
      }

      const fingerprints = validKeyData.map((kd) => kd.fingerprint)
      const uniqueFingerprints = [...new Set(fingerprints)]
      if (uniqueFingerprints.length !== fingerprints.length) {
        throw new Error(
          'Multisig wallets require unique keys. Using the same seed for multiple keys is not allowed. Each key must be derived from a different seed.'
        )
      }

      const extendedPublicKeys = validKeyData.map((kd) => kd.extendedPublicKey)
      const uniqueExtendedPublicKeys = [...new Set(extendedPublicKeys)]
      if (uniqueExtendedPublicKeys.length !== extendedPublicKeys.length) {
        throw new Error(
          'Multisig wallets require unique keys. Using the same extended public key for multiple keys is not allowed.'
        )
      }

      const policyDerivationPath = getMultisigDerivationPathFromScriptVersion(
        scriptVersion,
        toAppNetwork(network)
      )

      const cleanPolicyPath = policyDerivationPath.replace(/^m\/?/i, '')

      const sortedKeyData = validKeyData.toSorted((a, b) =>
        a.extendedPublicKey.localeCompare(b.extendedPublicKey)
      )

      const keySection = sortedKeyData
        .map(
          ({ fingerprint, extendedPublicKey }) =>
            `[${fingerprint}/${cleanPolicyPath}]${extendedPublicKey}/<0;1>/*`
        )
        .join(',')

      let finalDescriptor = ''
      switch (multisigScriptType) {
        case 'P2SH':
          finalDescriptor = `sh(sortedmulti(${account.keysRequired},${keySection}))`
          break
        case 'P2SH-P2WSH':
          finalDescriptor = `sh(wsh(sortedmulti(${account.keysRequired},${keySection})))`
          break
        case 'P2WSH':
          finalDescriptor = `wsh(sortedmulti(${account.keysRequired},${keySection}))`
          break
        case 'P2TR':
          finalDescriptor = `tr(sortedmulti(${account.keysRequired},${keySection}))`
          break
        default:
          finalDescriptor = `wsh(sortedmulti(${account.keysRequired},${keySection}))`
      }

      const externalDescriptor = finalDescriptor.replace(/<0;1>/g, '0')
      const internalDescriptor = finalDescriptor.replace(/<0;1>/g, '1')

      const parsedDescriptor = parseDescriptor(externalDescriptor)

      const wallet = await getWalletFromDescriptor(
        externalDescriptor,
        internalDescriptor,
        network
      )

      const keyFingerprints = validKeyData.map((kd) => kd.fingerprint)

      return {
        derivationPath: parsedDescriptor.derivationPath,
        externalDescriptor: finalDescriptor,
        fingerprint: parsedDescriptor.fingerprint,
        internalDescriptor: '',
        keyFingerprints,
        wallet
      }
    }
    case 'watchonly': {
      if (account.keys.length !== 1) {
        throw new Error('Invalid key count for singlesig')
      }

      const [key] = account.keys

      if (key.creationType === 'importDescriptor') {
        if (typeof key.secret === 'string' || !key.secret.externalDescriptor) {
          throw new Error('Invalid secret')
        }

        const { externalDescriptor } = key.secret
        const { internalDescriptor } = key.secret

        const parsedDescriptor = parseDescriptor(externalDescriptor)
        const wallet = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor,
          fingerprint: parsedDescriptor.fingerprint,
          internalDescriptor: internalDescriptor || '',
          wallet
        }
      } else if (key.creationType === 'importExtendedPub') {
        if (
          !key.scriptVersion ||
          typeof key.secret === 'string' ||
          !key.secret.fingerprint ||
          !key.secret.extendedPublicKey
        ) {
          throw new Error('Invalid account information')
        }

        let template: DescriptorTemplate
        switch (key.scriptVersion) {
          case 'P2PKH':
            template = DescriptorTemplate.Bip44
            break
          case 'P2SH-P2WPKH':
            template = DescriptorTemplate.Bip49
            break
          case 'P2WPKH':
            template = DescriptorTemplate.Bip84
            break
          case 'P2TR':
            template = DescriptorTemplate.Bip86
            break
          case 'P2WSH':
          case 'P2SH-P2WSH':
          case 'P2SH':
            throw new Error(
              `Manual descriptor creation required for ${key.scriptVersion}`
            )
          default:
            template = DescriptorTemplate.Bip84
            break
        }

        const externalDescriptor = createPublicDescriptor(
          key.secret.extendedPublicKey,
          template,
          KeychainKind.External,
          network
        )
        const internalDescriptor = createPublicDescriptor(
          key.secret.extendedPublicKey,
          template,
          KeychainKind.Internal,
          network
        )

        const parsedDescriptor = parseDescriptor(externalDescriptor)
        const wallet = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor,
          fingerprint: parsedDescriptor.fingerprint,
          internalDescriptor,
          wallet
        }
      } else if (key.creationType === 'importAddress') {
        // BDK does not support address descriptor
      }

      break
    }
    default:
      break
  }
}

function getDescriptorMultiSig(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  kind: KeychainKind,
  passphrase: Secret['passphrase'],
  network: Network
): string {
  const baseString = getPrivateDescriptorFromMnemonic(
    mnemonic,
    'P2WPKH',
    kind,
    passphrase,
    network
  )
  const keyPart = baseString.replace(/^wpkh\(/, '').replace(/\)$/, '')

  switch (scriptVersion) {
    case 'P2WSH':
      return `wsh(${keyPart})`
    case 'P2SH-P2WSH':
      return `sh(wsh(${keyPart}))`
    case 'P2SH':
      return `sh(${keyPart})`
    default:
      throw new Error(`Unsupported script version: ${scriptVersion}`)
  }
}

async function getWalletDataFromMnemonic(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  passphrase: Secret['passphrase'],
  network: Network
) {
  const externalDescriptor = await getDescriptorString(
    mnemonic,
    scriptVersion,
    KeychainKind.External,
    passphrase,
    network
  )
  const internalDescriptor = await getDescriptorString(
    mnemonic,
    scriptVersion,
    KeychainKind.Internal,
    passphrase,
    network
  )

  const { fingerprint, derivationPath } = parseDescriptor(externalDescriptor)

  const wallet = await getWalletFromDescriptor(
    externalDescriptor,
    internalDescriptor,
    network
  )

  return {
    derivationPath,
    externalDescriptor,
    fingerprint,
    internalDescriptor,
    wallet
  }
}

function getDescriptorString(
  mnemonic: NonNullable<Secret['mnemonic']>,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  kind: KeychainKind,
  passphrase: Secret['passphrase'],
  network: Network
) {
  const electrumType = detectElectrumSeed(mnemonic)
  if (electrumType) {
    return getPrivateDescriptorFromElectrumMnemonic(
      mnemonic,
      electrumType,
      kind,
      passphrase || '',
      network
    )
  }

  if (
    scriptVersion === 'P2SH' ||
    scriptVersion === 'P2SH-P2WSH' ||
    scriptVersion === 'P2WSH'
  ) {
    return getDescriptorMultiSig(
      mnemonic,
      scriptVersion,
      kind,
      passphrase,
      network
    )
  }

  return getPrivateDescriptorFromMnemonic(
    mnemonic,
    scriptVersion,
    kind,
    passphrase,
    network
  )
}

function parseDescriptor(descriptorString: string) {
  if (!descriptorString) {
    return { derivationPath: '', fingerprint: '' }
  }
  const match = descriptorString.match(/\[([0-9a-f]+)([0-9'/]+)\]/)
  return match
    ? { derivationPath: `m${match[2]}`, fingerprint: match[1] }
    : { derivationPath: '', fingerprint: '' }
}

async function getWalletFromDescriptor(
  externalDescriptor: string,
  internalDescriptor: string | undefined,
  network: Network
): Promise<BdkWallet> {
  const ext = externalDescriptor.replace(/#\w+$/, '').replace(/'/g, 'h')
  const int = internalDescriptor?.replace(/#\w+$/, '').replace(/'/g, 'h')
  const dbPath = await getWalletDbPath(ext, int, network)
  return new BdkWallet(ext, int, network, dbPath)
}

async function getExtendedPublicKeyFromAccountKey(key: Key, network: Network) {
  if (
    typeof key.secret === 'string' ||
    !key.secret.mnemonic ||
    !key.scriptVersion
  ) {
    return
  }

  const externalDescriptor = await getDescriptorString(
    key.secret.mnemonic,
    key.scriptVersion,
    KeychainKind.External,
    key.secret.passphrase,
    network
  )
  return getExtendedKeyFromDescriptor(externalDescriptor)
}

async function syncWallet(
  wallet: BdkWallet,
  backend: Backend,
  url: string,
  stopGap: number,
  isFullScan: boolean
) {
  if (isFullScan) {
    if (backend === 'electrum') {
      await wallet.fullScanWithElectrum(url, stopGap)
    } else {
      await wallet.fullScanWithEsplora(url, stopGap)
    }
  } else if (backend === 'electrum') {
    await wallet.syncWithElectrum(url, stopGap)
  } else {
    await wallet.syncWithEsplora(url, stopGap)
  }

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
    parseTxDetailsToTransaction(txDetails, localOutputs, network)
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

  addresses = parseAccountAddressesDetails({
    addresses,
    keys: [{ scriptVersion: undefined }],
    transactions,
    utxos
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
    summary: {
      balance: balance.confirmed,
      numberOfAddresses,
      numberOfTransactions: txDetailsList.length,
      numberOfUtxos: localOutputs.length,
      satsInMempool: balance.trustedPending + balance.untrustedPending
    },
    transactions,
    utxos
  }
}

function parseTxDetailsToTransaction(
  txDetails: TxDetailsN,
  utxos: LocalOutputN[],
  network: Network
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
    txHex,
    version,
    locktime,
    inputs,
    outputs
  } = txDetails

  const raw = txHex ? hexToBytes(txHex) : []

  const vin: Transaction['vin'] = inputs.map((input) => ({
    previousOutput: {
      txid: input.previousTxid,
      vout: input.previousVout
    },
    scriptSig: hexToBytes(input.scriptSigHex),
    sequence: input.sequence,
    witness: input.witness.map((w) => hexToBytes(w))
  }))

  const vout: Transaction['vout'] = outputs.map((output) => ({
    address: output.address || '',
    script: hexToBytes(output.scriptPubkeyHex),
    value: output.value
  }))

  let size = 0
  let vsize = 0
  let weight = 0
  if (raw.length) {
    size = raw.length
    weight = size * 4
    vsize = Math.ceil(weight / 3)
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
      ? new Date(confirmationBlockTime.timestamp * 1000)
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
  const script = hexToBytes(localOutput.txout.scriptPubkeyHex)

  return {
    addressTo,
    keychain: 'external',
    label: '',
    script,
    timestamp: txDetails?.confirmationBlockTime?.timestamp
      ? new Date(txDetails.confirmationBlockTime.timestamp * 1000)
      : undefined,
    txid: transactionId,
    value: localOutput.txout.value,
    vout: localOutput.outpoint.vout
  }
}

async function getTransactionInputValues(
  tx: Transaction,
  backend: Backend,
  network: BlockchainNetwork,
  url: string
): Promise<Transaction['vin']> {
  if (!tx.vin.some((input) => input.value === undefined)) {
    return tx.vin
  }

  let vin: Transaction['vin'] = []

  if (backend === 'electrum') {
    const electrumClient = await AppElectrumClient.initClientFromUrl(
      url,
      network
    )
    vin = await electrumClient.getTxInputValues(tx)
    electrumClient.close()
  }

  if (backend === 'esplora') {
    const esploraClient = new Esplora(url)
    vin = await esploraClient.getTxInputValues(tx.id)
  }

  for (const [index, vinItem] of vin.entries()) {
    vin[index] = {
      ...(tx.vin[index] || {}),
      ...vinItem
    }
  }

  return vin
}

function getLastUnusedAddressFromWallet(wallet: BdkWallet): AddressInfo {
  return wallet.nextUnusedAddress(KeychainKind.External)
}

function buildTransaction(
  wallet: BdkWallet,
  data: {
    inputs: Utxo[]
    outputs: Output[]
    fee: number
    options: {
      rbf: boolean
    }
  }
): Promise<PsbtLike> {
  const txBuilder = new BdkTxBuilder()

  txBuilder.addUtxos(
    data.inputs.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout }))
  )
  txBuilder.manuallySelectedOnly()

  for (const output of data.outputs) {
    txBuilder.addRecipient(output.to, output.amount)
  }

  txBuilder.feeAbsolute(data.fee)

  if (data.options.rbf) {
    txBuilder.enableRbf()
  }

  return txBuilder.finish(wallet)
}

function signTransaction(psbt: PsbtLike, wallet: BdkWallet): boolean {
  const signed = wallet.sign(psbt)
  wallet.persist()
  return signed
}

function broadcastTransaction(
  wallet: BdkWallet,
  psbt: PsbtLike,
  backend: Backend,
  url: string
): Promise<string> {
  if (backend === 'electrum') {
    return wallet.broadcastWithElectrum(url, psbt)
  }
  return wallet.broadcastWithEsplora(url, psbt)
}

export {
  broadcastTransaction,
  buildTransaction,
  getDescriptorString,
  getExtendedPublicKeyFromAccountKey,
  getLastUnusedAddressFromWallet,
  getTransactionInputValues,
  getWalletAddresses,
  getWalletData,
  getWalletOverview,
  parseDescriptor,
  signTransaction,
  syncWallet
}
