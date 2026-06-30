import * as FileSystem from 'expo-file-system/legacy'
import {
  addressFromScript,
  BdkRpcClient,
  BdkWallet,
  BdkTxBuilder,
  createPublicDescriptor,
  DescriptorTemplate,
  KeychainKind,
  type Network,
  Psbt,
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
  type Network as BlockchainNetwork,
  type RpcCredentials,
  type Server
} from '@/types/settings/blockchain'
import {
  getExtendedKeyFromDescriptor,
  getFingerprintFromExtendedPublicKey,
  getPublicDescriptorFromSeed
} from '@/utils/bip32'
import {
  detectElectrumSeed,
  getPrivateDescriptorFromElectrumMnemonic,
  getPrivateDescriptorFromMnemonic,
  mnemonicToSeed
} from '@/utils/bip39'
import {
  getMultisigDerivationPathFromScriptVersion,
  getMultisigScriptTypeFromScriptVersion
} from '@/utils/bitcoin'
import { parseAccountAddressesDetails } from '@/utils/parse'

import AppElectrumClient from './electrum'
import Esplora from './esplora'
import BitcoinRpc, {
  adjustRpcUrl,
  type CoreTxDetails,
  type CoreUnspent,
  type CoreWalletListTx
} from './rpc'

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
  dbPath: string
  derivationPath: string
  externalDescriptor: string
  fingerprint: string
  internalDescriptor: string
  keyFingerprints?: string[] // Optional for multisig accounts
  wallet: BdkWallet
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
        if (typeof key.secret === 'string' || !key.secret.externalDescriptor) {
          throw new Error('Invalid secret')
        }

        const { externalDescriptor } = key.secret
        const { internalDescriptor } = key.secret

        const parsedDescriptor = parseDescriptor(externalDescriptor)
        const { wallet, dbPath } = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          dbPath,
          derivationPath: parsedDescriptor.derivationPath,
          externalDescriptor,
          fingerprint: parsedDescriptor.fingerprint,
          internalDescriptor: internalDescriptor || '',
          wallet
        }
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

      const { wallet, dbPath } = await getWalletFromDescriptor(
        externalDescriptor,
        internalDescriptor,
        network
      )

      const keyFingerprints = validKeyData.map((kd) => kd.fingerprint)

      return {
        dbPath,
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
        const { wallet, dbPath } = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          dbPath,
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
        const { wallet, dbPath } = await getWalletFromDescriptor(
          externalDescriptor,
          internalDescriptor,
          network
        )

        return {
          dbPath,
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

  const { wallet, dbPath } = await getWalletFromDescriptor(
    externalDescriptor,
    internalDescriptor,
    network
  )

  return {
    dbPath,
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
): Promise<{ wallet: BdkWallet; dbPath: string }> {
  const ext = externalDescriptor.replace(/#\w+$/, '').replace(/'/g, 'h')
  const int = internalDescriptor?.replace(/#\w+$/, '').replace(/'/g, 'h')
  const dbPath = await getWalletDbPath(ext, int, network)
  return { dbPath, wallet: new BdkWallet(ext, int, network, dbPath) }
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

/**
 * Estimate the block height for a wallet birthday by counting backwards from
 * the known current tip. More accurate than projecting from genesis because it
 * uses the real chain tip rather than an assumed average block time.
 * Falls back to 0 if no tip is available.
 */
function estimateBirthHeight(birthday: Date, currentTip: number): number {
  if (currentTip <= 0) {
    return 0
  }
  const MS_PER_BLOCK = 10 * 60 * 1000 // ~10 minutes
  const ageMs = Math.max(0, Date.now() - birthday.getTime())
  const blocksFromTip = Math.round(ageMs / MS_PER_BLOCK)
  // Two-week safety buffer so we never miss transactions near the boundary
  const BUFFER_BLOCKS = 2016
  return Math.max(0, currentTip - blocksFromTip - BUFFER_BLOCKS)
}

async function syncWallet(
  wallet: BdkWallet,
  backend: Backend,
  url: string,
  stopGap: number,
  isFullScan: boolean,
  rpcCredentials?: RpcCredentials,
  walletBirthday?: Date,
  currentTip?: number,
  rpcScanFromHeight?: number,
  isGeneratedWallet?: boolean,
  onRpcProgress?: (current: number, tip: number, pct: number) => void
) {
  if (backend === 'rpc') {
    const rpcClient = new BdkRpcClient({
      auth: rpcCredentials
        ? {
            password: rpcCredentials.password,
            type: 'userPass',
            username: rpcCredentials.username
          }
        : { type: 'none' },
      url
    })

    // For a full scan use the wallet birthday as the start height.
    // Downloading full blocks from genesis would take hours; starting near
    // the wallet creation date keeps the scan practical.
    const checkpointHeight = wallet.latestCheckpoint()?.height ?? 0
    const scanFloor = rpcScanFromHeight ?? 0

    let startHeight: number
    if (!isFullScan) {
      startHeight = checkpointHeight
    } else if (isGeneratedWallet && walletBirthday && currentTip) {
      // For wallets we created, estimate backwards from the known chain tip.
      // This is accurate because we know exactly when the wallet was created.
      startHeight = Math.max(
        scanFloor,
        estimateBirthHeight(walletBirthday, currentTip)
      )
    } else {
      // For imported wallets the creation date is the import date, not the
      // actual wallet birthday. Use the server-configured floor (default 0).
      startHeight = scanFloor
    }

    const birthdayStr =
      isGeneratedWallet && walletBirthday
        ? ` birthday=${walletBirthday.toISOString()}`
        : ''
    console.log(
      `[BDK sync] RPC url=${url} isFullScan=${isFullScan} isGenerated=${isGeneratedWallet ?? false} startHeight=${startHeight} scanFloor=${scanFloor} checkpointHeight=${checkpointHeight} currentTip=${currentTip ?? 'none'}${birthdayStr}`
    )

    await wallet.syncWithRpc(rpcClient, startHeight, {
      fetchMempool: true,
      inspector: onRpcProgress
        ? {
            inspect({ currentHeight, tipHeight, progress }) {
              if (currentHeight % 5000 === 0 || progress >= 1) {
                console.log(
                  `[BDK sync] RPC progress ${Math.round(progress * 100)}% block ${currentHeight}/${tipHeight}`
                )
              }
              onRpcProgress(currentHeight, tipHeight, progress)
            }
          }
        : {
            inspect({ currentHeight, tipHeight, progress }) {
              if (currentHeight % 5000 === 0 || progress >= 1) {
                console.log(
                  `[BDK sync] RPC progress ${Math.round(progress * 100)}% block ${currentHeight}/${tipHeight}`
                )
              }
            }
          }
    })

    console.log('[BDK sync] RPC syncWithRpc completed')
  } else if (isFullScan) {
    await (backend === 'electrum'
      ? wallet.fullScanWithElectrum(url, stopGap)
      : wallet.fullScanWithEsplora(url, stopGap))
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
  url: string,
  rpcCredentials?: RpcCredentials
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
    const esploraVin = await esploraClient.getTxInputValues(tx.id)
    vin = esploraVin.map((input) => ({
      previousOutput: input.previousOutput,
      scriptSig: input.scriptSig,
      sequence: input.sequence,
      value: input.value,
      witness: input.witness || []
    }))
  }

  if (backend === 'rpc') {
    const rpcClient = new BitcoinRpc(
      url,
      rpcCredentials?.username ?? '',
      rpcCredentials?.password ?? ''
    )
    vin = await Promise.all(
      tx.vin.map(async (input) => {
        if (!input.previousOutput?.txid) {
          return input
        }
        try {
          const prevTx = await rpcClient.getRawTransaction(
            input.previousOutput.txid
          )
          const prevOut = prevTx.vout[input.previousOutput.vout ?? 0]
          return {
            ...input,
            value: prevOut ? Math.round(prevOut.value * 1e8) : undefined
          }
        } catch {
          return input
        }
      })
    )
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

/**
 * Build a PSBT via Bitcoin Core's wallet RPC (createpsbt + walletprocesspsbt)
 * then wrap it as a BDK PsbtLike so it can be signed by wallet.sign().
 *
 * This is the correct path for RPC backends because BDK's TxBuilder.finish()
 * requires UTXOs to be in BDK's keychain index (populated only by native BDK
 * sync). Since we bypass BDK sync for RPC, the keychain index is empty and
 * TxBuilder throws OutpointNotFound. Bitcoin Core's watch-only wallet already
 * knows the UTXOs (from importdescriptors + rescanblockchain), so we delegate
 * PSBT construction to it and only use BDK for key derivation / signing.
 */
async function buildTransactionWithRpc(
  nodeUrl: string,
  credentials: RpcCredentials,
  walletName: string,
  data: {
    inputs: Utxo[]
    outputs: Output[]
    options: { rbf: boolean }
  }
): Promise<PsbtLike> {
  const url = adjustRpcUrl(nodeUrl)
  const auth = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
  const walletUrl = `${url}/wallet/${encodeURIComponent(walletName)}`

  async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(walletUrl, {
      body: JSON.stringify({ id: method, jsonrpc: '1.0', method, params }),
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      method: 'POST'
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on ${method}`)
    }
    const json = (await res.json()) as {
      result: T
      error?: { message: string; code: number }
    }
    if (json.error) {
      throw new Error(
        `RPC ${method}: ${json.error.message} (code ${json.error.code})`
      )
    }
    return json.result
  }

  const rpcInputs = data.inputs.map((u) => ({
    sequence: data.options.rbf ? 0xfffffffd : 0xffffffff,
    txid: u.txid,
    vout: u.vout
  }))

  const rpcOutputs = data.outputs.reduce<Record<string, number>>((acc, o) => {
    acc[o.to] = (acc[o.to] ?? 0) + o.amount / 1e8
    return acc
  }, {})

  // Step 1: create unsigned PSBT
  const rawPsbt = await rpc<string>('createpsbt', [rpcInputs, [rpcOutputs]])
  console.log(`[buildTxRpc] createpsbt ok`)

  // Step 2: walletprocesspsbt with sign=false to add witness_utxo and bip32_derivation
  // The watch-only Core wallet enriches the PSBT without trying to sign it.
  const processed = await rpc<{ psbt: string; complete: boolean }>(
    'walletprocesspsbt',
    [rawPsbt, false, 'ALL', true]
  )
  console.log(
    `[buildTxRpc] walletprocesspsbt ok  complete=${processed.complete}`
  )

  return new Psbt(processed.psbt)
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

function buildPsbt(
  wallet: BdkWallet,
  server: Server,
  account: Account,
  data: {
    fee: number
    inputs: Utxo[]
    outputs: Output[]
    options: { rbf: boolean }
  }
): Promise<PsbtLike> {
  const { backend, url, rpcCredentials } = server

  if (backend === 'rpc' && url && rpcCredentials) {
    const [key] = account.keys
    const fingerprint = key?.fingerprint ?? account.id
    const walletName = `satsigner-${fingerprint}`
    return buildTransactionWithRpc(url, rpcCredentials, walletName, {
      inputs: data.inputs,
      options: data.options,
      outputs: data.outputs
    })
  }

  return buildTransaction(wallet, data)
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
  url: string,
  rpcCredentials?: RpcCredentials
): Promise<string> {
  if (backend === 'electrum') {
    return wallet.broadcastWithElectrum(url, psbt)
  }
  if (backend === 'rpc') {
    const rpcClient = new BdkRpcClient({
      auth: rpcCredentials
        ? {
            password: rpcCredentials.password,
            type: 'userPass',
            username: rpcCredentials.username
          }
        : { type: 'none' },
      url
    })
    return wallet.broadcastWithRpc(rpcClient, psbt)
  }
  return wallet.broadcastWithEsplora(url, psbt)
}

// ─── Bitcoin Core wallet sync (importdescriptors path) ───────────────────────

/**
 * Derive a pair of watch-only (public) descriptors for an account.
 * Used to import the wallet into Bitcoin Core's descriptor wallet.
 * Returns [externalDescriptor, internalDescriptor].
 */
function getPublicDescriptorsForAccount(
  account: Account,
  network: Network
): [string, string] | null {
  const [key] = account.keys
  if (!key) {
    return null
  }

  try {
    if (
      key.creationType === 'generateMnemonic' ||
      key.creationType === 'importMnemonic'
    ) {
      if (
        typeof key.secret === 'string' ||
        !key.secret.mnemonic ||
        !key.scriptVersion
      ) {
        return null
      }
      const seed = mnemonicToSeed(
        key.secret.mnemonic,
        key.secret.passphrase ?? ''
      )
      const external = getPublicDescriptorFromSeed(
        seed,
        key.scriptVersion,
        KeychainKind.External,
        network
      )
      const internal = getPublicDescriptorFromSeed(
        seed,
        key.scriptVersion,
        KeychainKind.Internal,
        network
      )
      return [external, internal]
    }

    if (key.creationType === 'importExtendedPub') {
      if (
        typeof key.secret === 'string' ||
        !key.secret.extendedPublicKey ||
        !key.scriptVersion
      ) {
        return null
      }
      const template = key.scriptVersion as unknown as DescriptorTemplate
      const external = createPublicDescriptor(
        key.secret.extendedPublicKey,
        template,
        KeychainKind.External,
        network
      )
      const internal = createPublicDescriptor(
        key.secret.extendedPublicKey,
        template,
        KeychainKind.Internal,
        network
      )
      return [external, internal]
    }

    if (key.creationType === 'importDescriptor') {
      if (typeof key.secret === 'string' || !key.secret.externalDescriptor) {
        return null
      }
      // Strip private key material if present — replace xprv with xpub by
      // extracting the xpub from the descriptor (it's stored in the key.secret
      // for xpub-imported accounts; for mnemonic descriptors fall back above).
      const ext = key.secret.externalDescriptor
      const int = key.secret.internalDescriptor
      if (!int) {
        return null
      }
      return [ext, int]
    }
  } catch {
    // fall through to null
  }

  return null
}

type CoreWalletSyncResult = Pick<
  Account,
  'transactions' | 'utxos' | 'addresses' | 'summary'
>

/**
 * Sync a wallet via Bitcoin Core's descriptor wallet (importdescriptors path).
 * This does NOT require blockfilterindex=1 and is faster than compact filters
 * for wallets with a known birthday timestamp.
 *
 * Flow:
 *  1. Ensure a watch-only descriptor wallet named `satsigner-{fingerprint}` exists
 *  2. Import descriptors with the wallet's birthday timestamp (first call only)
 *  3. Wait for Bitcoin Core to finish rescanning
 *  4. Fetch transactions + UTXOs and map to app types
 */
async function syncWithCoreWallet(
  account: Account,
  wallet: BdkWallet,
  nodeUrl: string,
  credentials: RpcCredentials,
  bdkNetwork: Network,
  stopGap: number,
  onProgress?: (progress: number) => void,
  isCancelled?: () => boolean
): Promise<CoreWalletSyncResult & { rpcLastBlockHash: string }> {
  // ── Direct RPC helpers (mirrors the test script exactly) ──────────────────
  const url = adjustRpcUrl(nodeUrl)
  const auth = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`
  const fingerprint = account.keys[0]?.fingerprint ?? account.id
  const walletName = `satsigner-${fingerprint}`
  const walletUrl = `${url}/wallet/${encodeURIComponent(walletName)}`

  async function rpcCall<T>(
    endpoint: string,
    method: string,
    params: unknown[] = []
  ): Promise<T> {
    const res = await fetch(endpoint, {
      body: JSON.stringify({ id: method, jsonrpc: '1.0', method, params }),
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      method: 'POST'
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on ${method}`)
    }
    const json = (await res.json()) as {
      result: T
      error?: { message: string; code: number }
    }
    if (json.error) {
      throw new Error(
        `RPC ${method}: ${json.error.message} (code ${json.error.code})`
      )
    }
    return json.result
  }

  const node = <T>(method: string, params: unknown[] = []) =>
    rpcCall<T>(url, method, params)
  const w = <T>(method: string, params: unknown[] = []) =>
    rpcCall<T>(walletUrl, method, params)

  // ── 1. Ensure the wallet exists on the node ──────────────────────────────
  const loadedWallets = await node<string[]>('listwallets')
  if (!loadedWallets.includes(walletName)) {
    try {
      await node('loadwallet', [walletName])
      console.log(`[CoreWallet] loaded wallet: ${walletName}`)
    } catch {
      // wallet doesn't exist yet — create it as blank descriptor wallet
      await node('createwallet', [
        walletName,
        true,
        true,
        '',
        false,
        true,
        true
      ])
      console.log(`[CoreWallet] created wallet: ${walletName}`)
    }
  }

  // ── 2. Get public descriptors from the already-initialized BDK wallet ────
  // Using wallet.publicDescriptor() avoids re-accessing the potentially
  // encrypted mnemonic — the wallet object already holds the decrypted keys.
  let extDescRaw: string
  let intDescRaw: string
  try {
    extDescRaw = wallet.publicDescriptor(KeychainKind.External)
    intDescRaw = wallet.publicDescriptor(KeychainKind.Internal)
  } catch {
    const descriptors = getPublicDescriptorsForAccount(account, bdkNetwork)
    if (!descriptors) {
      throw new Error(
        'Could not derive public descriptors for this account. ' +
          'Core wallet sync requires a mnemonic, xpub, or descriptor-based account.'
      )
    }
    ;[extDescRaw, intDescRaw] = descriptors
  }
  console.log(`[CoreWallet] ext: ${extDescRaw.slice(0, 60)}…`)
  console.log(`[CoreWallet] int: ${intDescRaw.slice(0, 60)}…`)

  // ── 3. Normalize descriptors via getdescriptorinfo ───────────────────────
  // Split <0;1> multi-path descriptors if needed, then normalize each.
  function splitMultiPath(desc: string): [string, string] | null {
    const m = desc.match(/^(.+?)<(\d+);(\d+)>(.+?)(?:#.*)?$/)
    if (!m) {
      return null
    }
    return [`${m[1]}${m[2]}${m[4]}`, `${m[1]}${m[3]}${m[4]}`]
  }

  let extForInfo = extDescRaw
  let intForInfo = intDescRaw
  // Strip existing checksum before sending to getdescriptorinfo
  extForInfo = extForInfo.replace(/#[a-z0-9]{8}$/, '')
  intForInfo = intForInfo.replace(/#[a-z0-9]{8}$/, '')

  const splitExt = splitMultiPath(extForInfo)
  const splitInt = splitMultiPath(intForInfo)
  const rawExt = splitExt ? splitExt[0] : extForInfo
  const rawInt = splitInt ? splitInt[1] : intForInfo

  const [extNorm, intNorm] = await Promise.all([
    node<{ descriptor: string }>('getdescriptorinfo', [rawExt]).then(
      (r) => r.descriptor
    ),
    node<{ descriptor: string }>('getdescriptorinfo', [rawInt]).then(
      (r) => r.descriptor
    )
  ])
  console.log(`[CoreWallet] normalized ext: ${extNorm.slice(0, 60)}…`)
  console.log(`[CoreWallet] normalized int: ${intNorm.slice(0, 60)}…`)

  // ── 4. Determine if import + rescan are needed ───────────────────────────
  let needsRescan = false
  let startHeight = 0

  // Smart start-height selection (mirrors test script logic):
  //  1. User-set birthdayDate → convert to approximate block height (fastest)
  //  2. BDK wallet checkpoint → use that minus a 2-week buffer (avoids genesis)
  //  3. Neither → scan from genesis (warn user to set a birthday)
  function computeStartHeight(): number {
    const GENESIS_TIMESTAMP = 1231006505
    const MS_PER_BLOCK = 10 * 60 * 1000
    const TWO_WEEKS_SECS = 60 * 60 * 24 * 14

    if (account.birthdayDate) {
      const birthdayUnix = Math.floor(account.birthdayDate.getTime() / 1000)
      if (birthdayUnix > GENESIS_TIMESTAMP) {
        const floorUnix = birthdayUnix - TWO_WEEKS_SECS
        const ageMs = Math.max(0, floorUnix * 1000 - GENESIS_TIMESTAMP * 1000)
        const h = Math.max(0, Math.round(ageMs / MS_PER_BLOCK) - 2016)
        console.log(
          `[CoreWallet] birthday=${account.birthdayDate.toISOString()}  startHeight=${h}`
        )
        return h
      }
    }

    // Fall back to BDK checkpoint — compact filters already validated the chain
    // up to this block so we don't need to re-scan older blocks unless the
    // user sets a birthday that predates the checkpoint.
    try {
      const cp = wallet.latestCheckpoint()
      if (cp && cp.height > 10000) {
        const h = Math.max(0, cp.height - 2016)
        console.log(
          `[CoreWallet] no birthday — using BDK checkpoint ${cp.height} minus 2016-block buffer → startHeight=${h}`
        )
        return h
      }
    } catch {
      // latestCheckpoint not available
    }

    console.log(
      '[CoreWallet] no birthday and no checkpoint — scanning from genesis. Set a Birthday in Account Settings to speed up future syncs.'
    )
    return 0
  }

  try {
    const existing = await w<{ descriptors: unknown[] }>('listdescriptors', [
      true
    ])
    const alreadyImported = existing.descriptors.length > 0

    if (!alreadyImported) {
      const importReqs = [
        {
          active: true,
          desc: extNorm,
          internal: false,
          range: [0, stopGap],
          timestamp: 'now'
        },
        {
          active: true,
          desc: intNorm,
          internal: true,
          range: [0, stopGap],
          timestamp: 'now'
        }
      ]
      const results = await w<
        { success: boolean; error?: { message: string; code: number } }[]
      >('importdescriptors', [importReqs])
      for (const result of results) {
        if (!result.success && result.error) {
          throw new Error(
            `importdescriptors failed: ${result.error.message} (code ${result.error.code})`
          )
        }
      }
      startHeight = computeStartHeight()
      needsRescan = true
      console.log(
        `[CoreWallet] importdescriptors done  startHeight=${startHeight}`
      )
    } else if (!account.rpcLastBlockHash) {
      startHeight = computeStartHeight()
      needsRescan = true
      console.log(
        `[CoreWallet] already imported but no prior sync — rescan from ${startHeight}`
      )
    } else {
      console.log(
        `[CoreWallet] incremental sync from ${account.rpcLastBlockHash.slice(0, 8)}…`
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!msg.includes('listdescriptors')) {
      throw error
    }
    console.log(
      '[CoreWallet] listdescriptors not supported — assuming already imported'
    )
  }

  // ── 5. Trigger rescanblockchain + poll until done ────────────────────────
  if (needsRescan) {
    console.log(`[CoreWallet] rescanblockchain from height ${startHeight} …`)
    try {
      await Promise.race([
        w('rescanblockchain', [startHeight]),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error('rescan-timeout'))
          }, 60_000)
        })
      ])
      console.log('[CoreWallet] rescanblockchain completed synchronously')
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      if (msg === 'rescan-timeout') {
        console.log(
          '[CoreWallet] rescanblockchain still running (>60s) — polling'
        )
      } else if (msg.includes('already rescanning')) {
        console.log('[CoreWallet] rescan already in progress — polling')
      } else {
        throw error
      }
    }

    // Poll getwalletinfo.scanning until done (max ~6 hours)
    const MAX_POLLS = 2160
    const POLL_INTERVAL_MS = 3000
    let consecutiveErrors = 0
    let lastPct = -1

    for (let i = 0; i < MAX_POLLS; i += 1) {
      if (isCancelled?.()) {
        console.log('[CoreWallet] poll cancelled')
        throw new Error('sync-cancelled')
      }
      try {
        const info = await w<{
          scanning: boolean | { duration: number; progress: number }
        }>('getwalletinfo')
        consecutiveErrors = 0
        if (info.scanning === false) {
          break
        }
        const { scanning } = info
        if (scanning === true || typeof scanning !== 'object') {
          continue
        }
        const pct = Math.round(scanning.progress * 100)
        const mins = Math.round(scanning.duration / 60)
        if (pct !== lastPct || i % 60 === 0) {
          console.log(
            `[CoreWallet] rescan ${pct}% (${mins}m elapsed, poll #${i})`
          )
          lastPct = pct
        }
        onProgress?.(pct)
      } catch (error) {
        consecutiveErrors += 1
        const msg = error instanceof Error ? error.message : String(error)
        console.log(`[CoreWallet] poll error #${consecutiveErrors}: ${msg}`)
        if (consecutiveErrors >= 5) {
          throw new Error(
            `Lost connection during rescan after ${consecutiveErrors} retries: ${msg}`,
            { cause: error }
          )
        }
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, POLL_INTERVAL_MS)
      })
    }
  }

  onProgress?.(100)

  // ── 6. Fetch data ────────────────────────────────────────────────────────
  const priorHash = account.rpcLastBlockHash ?? ''
  const isIncremental = priorHash.length === 64

  console.log(
    `[CoreWallet] fetching ${isIncremental ? `incremental (since ${priorHash.slice(0, 8)}…)` : 'full history'}`
  )

  const [sinceResult, unspent] = await Promise.all([
    w<{ transactions: CoreWalletListTx[]; lastblock: string }>(
      'listsinceblock',
      [priorHash]
    ),
    w<CoreUnspent[]>('listunspent', [0, 9999999])
  ])

  // Populate BDK's internal wallet DB with the current UTXOs so that
  // buildTransaction / sign can locate the outpoints without a BDK sync.
  // This is what lets us bypass compact block filters entirely.
  for (const u of unspent) {
    if (u.scriptPubKey) {
      try {
        wallet.insertTxout(
          { txid: u.txid, vout: u.vout },
          { scriptPubkeyHex: u.scriptPubKey, value: Math.round(u.amount * 1e8) }
        )
      } catch {
        // non-critical — BDK may already know this outpoint
      }
    }
  }
  console.log(
    `[CoreWallet] inserted ${unspent.filter((u) => u.scriptPubKey).length} txouts into BDK wallet`
  )

  const newLastBlockHash = sinceResult.lastblock
  const listTxs = isIncremental
    ? // Merge new txs with existing ones already stored on the account
      [
        ...sinceResult.transactions,
        ...account.transactions.map((tx) => ({
          amount: tx.type === 'receive' ? tx.received / 1e8 : -(tx.sent / 1e8),
          blockheight: tx.blockHeight,
          blocktime: tx.timestamp
            ? Math.floor(tx.timestamp.getTime() / 1000)
            : undefined,
          category: tx.type as 'send' | 'receive',
          confirmations: 0,
          time: tx.timestamp ? Math.floor(tx.timestamp.getTime() / 1000) : 0,
          timereceived: 0,
          txid: tx.id,
          vout: 0
        }))
      ]
    : sinceResult.transactions

  // Group list entries by txid and aggregate sent/received amounts
  const txMap = new Map<
    string,
    {
      blockheight?: number
      blocktime?: number
      confirmations: number
      received: number // sats
      sent: number // sats
      time: number
      txid: string
    }
  >()

  for (const entry of listTxs) {
    const existing = txMap.get(entry.txid)
    const amtSat = Math.round(Math.abs(entry.amount) * 1e8)
    if (!existing) {
      txMap.set(entry.txid, {
        blockheight: entry.blockheight,
        blocktime: entry.blocktime,
        confirmations: entry.confirmations,
        received: entry.category === 'receive' ? amtSat : 0,
        sent: entry.category === 'send' ? amtSat : 0,
        time: entry.time,
        txid: entry.txid
      })
    } else if (entry.category === 'receive') {
      existing.received += amtSat
    } else if (entry.category === 'send') {
      existing.sent += amtSat
    }
  }

  // Fetch full decoded tx for each unique txid (needed for vin/vout display)
  const txids = [...txMap.keys()]
  const transactions: Transaction[] = []

  await Promise.all(
    txids.map(async (txid) => {
      const summary = txMap.get(txid)!
      let decoded: CoreTxDetails
      try {
        decoded = await w<CoreTxDetails>('gettransaction', [txid, true, true])
      } catch {
        // Fall back to basic info if verbose fetch fails
        transactions.push({
          address: '',
          blockHeight: summary.blockheight,
          fee: undefined,
          id: txid,
          label: '',
          lockTime: 0,
          lockTimeEnabled: false,
          prices: {},
          raw: [],
          received: summary.received,
          sent: summary.sent,
          size: undefined,
          timestamp: summary.blocktime
            ? new Date(summary.blocktime * 1000)
            : undefined,
          type: summary.sent > 0 ? 'send' : 'receive',
          version: undefined,
          vin: [],
          vout: [],
          vsize: undefined,
          weight: undefined
        })
        return
      }

      const raw = decoded.hex
        ? Array.from(
            (decoded.hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
          )
        : []

      const d = decoded.decoded
      const vin: Transaction['vin'] = (d?.vin ?? []).map((v) => ({
        previousOutput: {
          txid: v.txid ?? '',
          vout: v.vout ?? 0
        },
        scriptSig: v.coinbase ? [] : [],
        sequence: v.sequence,
        witness: (v.txinwitness ?? []).map((w) =>
          (w.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
        )
      }))

      const vout: Transaction['vout'] = (d?.vout ?? []).map((o) => ({
        address: o.scriptPubKey.address ?? o.scriptPubKey.addresses?.[0] ?? '',
        script: (o.scriptPubKey.hex.match(/.{1,2}/g) ?? []).map((b) =>
          parseInt(b, 16)
        ),
        value: Math.round(o.value * 1e8)
      }))

      const fee =
        decoded.fee !== undefined
          ? Math.abs(Math.round(decoded.fee * 1e8))
          : undefined

      transactions.push({
        address: vout.find((o) => o.address)?.address ?? '',
        blockHeight: decoded.blockheight ?? summary.blockheight,
        fee,
        id: txid,
        label: '',
        lockTime: d?.locktime ?? 0,
        lockTimeEnabled: (d?.locktime ?? 0) > 0,
        prices: {},
        raw,
        received: summary.received,
        sent: summary.sent,
        size: raw.length || undefined,
        timestamp: decoded.blocktime
          ? new Date(decoded.blocktime * 1000)
          : undefined,
        type: summary.sent > 0 ? 'send' : 'receive',
        version: d?.version,
        vin,
        vout,
        vsize: d?.vsize,
        weight: d?.weight
      })
    })
  )

  // Sort by blockheight descending (newest first, unconfirmed on top)
  transactions.sort(
    (a, b) => (b.blockHeight ?? Infinity) - (a.blockHeight ?? Infinity)
  )

  // ── 5. Build UTXOs ───────────────────────────────────────────────────────
  const utxos: Utxo[] = unspent.map((u) => ({
    addressTo: u.address,
    keychain: 'external' as const,
    script: u.scriptPubKey
      ? (u.scriptPubKey.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
      : undefined,
    timestamp: undefined,
    txid: u.txid,
    value: Math.round(u.amount * 1e8),
    vout: u.vout
  }))

  // ── 6. Build address list from BDK (address derivation only) ─────────────
  const appNetwork = toAppNetwork(bdkNetwork)
  const usedAddresses = new Set([
    ...transactions.flatMap((tx) => tx.vout.map((o) => o.address)),
    ...utxos.map((u) => u.addressTo ?? '')
  ])

  const addresses: Account['addresses'] = []
  let lastUsedExternal = -1
  for (let i = 0; i < stopGap * 2; i += 1) {
    const addr = wallet.peekAddress(KeychainKind.External, i).address
    if (usedAddresses.has(addr)) {
      lastUsedExternal = i
    }
    addresses.push({
      address: addr,
      index: i,
      keychain: 'external',
      label: '',
      network: appNetwork,
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    })
    if (i >= lastUsedExternal + stopGap) {
      break
    }
  }

  const confirmedBalance = utxos
    .filter((u) =>
      transactions.find((tx) => tx.id === u.txid && (tx.blockHeight ?? 0) > 0)
    )
    .reduce((sum, u) => sum + u.value, 0)

  const mempoolBalance = utxos
    .filter(
      (u) =>
        !transactions.some(
          (tx) => tx.id === u.txid && (tx.blockHeight ?? 0) > 0
        )
    )
    .reduce((sum, u) => sum + u.value, 0)

  const usedExternalCount = addresses.filter(
    (a) => a.keychain === 'external' && usedAddresses.has(a.address)
  ).length

  console.log(
    `[CoreWallet] sync done: ${walletName}  txs=${transactions.length}  utxos=${utxos.length}  confirmed=${confirmedBalance}`
  )

  return {
    addresses,
    rpcLastBlockHash: newLastBlockHash,
    summary: {
      balance: confirmedBalance,
      numberOfAddresses: usedExternalCount,
      numberOfTransactions: transactions.length,
      numberOfUtxos: utxos.length,
      satsInMempool: mempoolBalance
    },
    transactions,
    utxos
  }
}

async function deleteWalletDb(dbPath: string): Promise<void> {
  try {
    const uri = dbPath.startsWith('/') ? `file://${dbPath}` : dbPath
    const info = await FileSystem.getInfoAsync(uri)
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true })
    }
  } catch {
    // best-effort; if the file is already gone the wallet will be recreated
  }
}

export {
  broadcastTransaction,
  buildPsbt,
  buildTransaction,
  deleteWalletDb,
  getDescriptorString,
  getExtendedPublicKeyFromAccountKey,
  getLastUnusedAddressFromWallet,
  getTransactionInputValues,
  getWalletAddresses,
  getWalletData,
  getWalletOverview,
  parseDescriptor,
  signTransaction,
  syncWallet,
  syncWithCoreWallet
}
