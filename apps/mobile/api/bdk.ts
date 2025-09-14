import { HDKey } from '@scure/bip32'
import * as bip39 from '@scure/bip39'
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

import {
  type Account,
  type Key,
  type ScriptVersionType,
  type Secret
} from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import {
  type Backend,
  type Network as BlockchainNetwork
} from '@/types/settings/blockchain'
import {
  fingerprintToHex,
  getAllXpubs,
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion,
  getMultisigScriptTypeFromScriptVersion,
  getVersionsForNetwork,
  getXpubForScriptVersion,
  toHex
} from '@/utils/bitcoin'
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
  if (!mnemonic) {
    throw new Error('Failed to generate mnemonic')
  }
  return mnemonic.asString()
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
  if (!mnemonic) {
    throw new Error('Failed to generate mnemonic from entropy')
  }
  return mnemonic.asString()
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
      throw new Error('Failed to create descriptor from extended public key')
    }
    const parsedDescriptor = await parseDescriptor(descriptor)
    return parsedDescriptor.fingerprint
  } catch (error) {
    throw new Error(
      `Failed to extract fingerprint: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
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
      // Get script version from the first key (all keys should have the same script version)
      const scriptVersion = account.keys[0]?.scriptVersion || 'P2WSH'
      const multisigScriptType =
        getMultisigScriptTypeFromScriptVersion(scriptVersion)

      // Extract key data with proper derivation paths and fingerprints
      const keyData = await Promise.all(
        account.keys.map(async (key, keyIndex) => {
          let extendedPublicKey = ''
          let fingerprint = ''

          if (typeof key.secret === 'object') {
            // Get fingerprint from secret or key
            fingerprint =
              (typeof key.secret === 'object' && key.secret.fingerprint) ||
              key.fingerprint ||
              ''

            // Get extended public key from various sources
            if (key.secret.extendedPublicKey) {
              extendedPublicKey = key.secret.extendedPublicKey
            } else if (key.secret.externalDescriptor) {
              try {
                const descriptor = await new Descriptor().create(
                  key.secret.externalDescriptor,
                  network
                )
                const extractedKey =
                  await extractExtendedKeyFromDescriptor(descriptor)
                if (extractedKey) {
                  extendedPublicKey = extractedKey
                }
              } catch (_error) {
                // Failed to extract extended public key
              }
            }
          }

          // If we still don't have a fingerprint, try to extract it from the extended public key
          if (!fingerprint && extendedPublicKey) {
            try {
              fingerprint = await extractFingerprintFromExtendedPublicKey(
                extendedPublicKey,
                network
              )
            } catch (_error) {
              // Failed to extract fingerprint
            }
          }

          return { fingerprint, extendedPublicKey, index: keyIndex }
        })
      )

      // Filter out keys that don't have both fingerprint and extended public key
      const validKeyData = keyData.filter(
        (kd) => kd.fingerprint && kd.extendedPublicKey
      )

      if (validKeyData.length !== account.keys.length) {
        throw new Error(
          `Failed to extract extended public keys from all keys (${validKeyData.length}/${account.keys.length})`
        )
      }

      // Check for duplicate fingerprints (same seed used for multiple keys)
      const fingerprints = validKeyData.map((kd) => kd.fingerprint)
      const uniqueFingerprints = [...new Set(fingerprints)]
      if (uniqueFingerprints.length !== fingerprints.length) {
        throw new Error(
          'Multisig wallets require unique keys. Using the same seed for multiple keys is not allowed. Each key must be derived from a different seed.'
        )
      }

      // Check for duplicate extended public keys
      const extendedPublicKeys = validKeyData.map((kd) => kd.extendedPublicKey)
      const uniqueExtendedPublicKeys = [...new Set(extendedPublicKeys)]
      if (uniqueExtendedPublicKeys.length !== extendedPublicKeys.length) {
        throw new Error(
          'Multisig wallets require unique keys. Using the same extended public key for multiple keys is not allowed.'
        )
      }

      // Get the policy-based derivation path according to the account type
      // Use the original scriptVersion for derivation path, not the mapped multisig script type
      const policyDerivationPath = getMultisigDerivationPathFromScriptVersion(
        scriptVersion, // Use original scriptVersion instead of multisigScriptType
        network as BlockchainNetwork
      )

      // Remove leading 'm' or 'M' from derivationPath if present
      const cleanPolicyPath = policyDerivationPath.replace(/^m\/?/i, '')

      // Build key section with policy-based derivation paths and fingerprints
      const keySection = validKeyData
        .map(({ fingerprint, extendedPublicKey }) => {
          // Format: [FINGERPRINT/POLICY_DERIVATION_PATH]XPUB/<0;1>/*
          return `[${fingerprint}/${cleanPolicyPath}]${extendedPublicKey}/<0;1>/*`
        })
        .join(',')

      // Create descriptor based on script type using sortedmulti
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

      // Since BDK doesn't support multipath descriptors directly, we need to create separate descriptors
      // for external (0/*) and internal (1/*) addresses
      const externalDescriptor = finalDescriptor.replace(/<0;1>/g, '0')
      const internalDescriptor = finalDescriptor.replace(/<0;1>/g, '1')

      const externalDesc = await new Descriptor().create(
        externalDescriptor,
        network
      )
      const internalDesc = await new Descriptor().create(
        internalDescriptor,
        network
      )
      if (!multisigDescriptor) {
        throw new Error('Failed to create multisig descriptor')
      }

      const parsedDescriptor = await parseDescriptor(externalDesc)

      const wallet = await getWalletFromDescriptor(
        externalDesc,
        internalDesc,
        network
      )

      // Extract individual key fingerprints
      const keyFingerprints = validKeyData.map((kd) => kd.fingerprint)

      return {
        fingerprint: parsedDescriptor.fingerprint,
        derivationPath: parsedDescriptor.derivationPath,
        externalDescriptor: finalDescriptor, // Store the original multipath descriptor
        internalDescriptor: '',
        wallet,
        keyFingerprints
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
          typeof key.secret === 'string' ||
          !key.secret.fingerprint ||
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
              key.secret.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip44Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2SH-P2WPKH':
            externalDescriptor = await new Descriptor().newBip49Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip49Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2WPKH':
            externalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2TR':
            externalDescriptor = await new Descriptor().newBip86Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip86Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.Internal,
              network
            )
            break
          case 'P2WSH':
          case 'P2SH-P2WSH':
          case 'P2SH':
            // For multisig script types, we need to create descriptors manually
            throw new Error(
              `Manual descriptor creation required for ${key.scriptVersion}`
            )
          default:
            externalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.secret.fingerprint,
              KeychainKind.External,
              network
            )
            internalDescriptor = await new Descriptor().newBip84Public(
              extendedPublicKey,
              key.secret.fingerprint,
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
        case 'P2SH':
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

/** Parse BIP32 path like "m/48'/0'/0'/2'" -> array of indexes (with hardened offset) */
function parsePath(path: string): number[] {
  if (!path || path === 'm') return []

  const parts = path.split('/')
  if (parts[0] !== 'm') throw new Error('Derivation path must start with "m"')

  const HARDENED_OFFSET = 0x80000000 // replace HDKey.HARDENED_OFFSET

  const items = parts.slice(1).map((p: string) => {
    const hardened = /('|h|H)$/.test(p)
    const index = parseInt(p.replace(/['hH]/, ''), 10)
    if (Number.isNaN(index)) throw new Error('Invalid path segment: ' + p)
    return hardened ? index + HARDENED_OFFSET : index
  })

  return items
}

interface DeriveOptions {
  network?: 'mainnet' | 'testnet'
  path?: string
}

interface DerivationStep {
  depth: number
  index: number
  parentFingerprint: string
  fingerprint: string
  publicExtendedKey: string
}

function deriveXpubFromMnemonic(
  mnemonic: string,
  passphrase: string = '',
  opts: DeriveOptions = {}
) {
  const network: 'mainnet' | 'testnet' =
    opts.network === 'testnet' ? 'testnet' : 'mainnet'

  // default BIP48 P2WSH path
  const coinType = network === 'mainnet' ? 0 : 1
  const defaultPath = `m/48'/${coinType}'/0'/2'`
  const path = opts.path || defaultPath

  // Use the utils function for P2WSH xpub (default path)

  // For the detailed derivation steps, we still need to do manual derivation
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)

  // 2) master HDKey
  const versions = getVersionsForNetwork(network)
  const master = HDKey.fromMasterSeed(seed, versions)

  // ensure publicKey is not null
  const masterPubkeyHex = toHex(master.publicKey || new Uint8Array())
  const masterFingerprintHex = fingerprintToHex(master.fingerprint)

  // 3) derive path
  const indices = parsePath(path)
  let node = master
  const steps: DerivationStep[] = []

  let parentFingerprint = 0

  indices.forEach((index, i) => {
    node = node.deriveChild(index)

    if (i === 2) {
      parentFingerprint = node.fingerprint
    }

    steps.push({
      depth: node.depth,
      index,
      parentFingerprint: fingerprintToHex(node.parentFingerprint || 0),
      fingerprint: fingerprintToHex(node.fingerprint),
      publicExtendedKey: node.publicExtendedKey
    })
  })

  const accountXpub = node.publicExtendedKey

  return {
    network,
    path,
    masterFingerprint: masterFingerprintHex,
    masterPubkeyHex,
    xpub: accountXpub,
    parentFingerprint: fingerprintToHex(parentFingerprint),
    steps
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
    case 'P2SH':
    case 'P2SH-P2WSH':
    case 'P2WSH':
      // For multisig script types, we need to create descriptors manually
      // since BDK doesn't have specific methods for these
      throw new Error(
        `Manual descriptor creation required for ${scriptVersion} - use getExtendedPublicKeyFromMnemonic instead`
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
    throw new Error('Descriptor is null or undefined')
  }
  const descriptorString = await descriptor.asString()
  const match = descriptorString.match(/(tpub|xpub|vpub|zpub)[A-Za-z0-9]+/)
  return match ? match[0] : ''
}

async function getExtendedPublicKeyFromAccountKey(
  key: Key,
  network: Network,
  isMultisig = false
) {
  if (typeof key.secret === 'string') return
  if (!key.secret.mnemonic || !key.scriptVersion) return

  if (isMultisig) {
    // For multisig accounts, we'll generate the extended public key using
    // standard BDK methods but then manually construct it with correct derivation path
    const externalDescriptor = await getDescriptor(
      key.secret.mnemonic,
      key.scriptVersion,
      KeychainKind.External,
      key.secret.passphrase,
      network
    )
    const standardExtendedKey =
      await extractExtendedKeyFromDescriptor(externalDescriptor)

    // The standardExtendedKey contains the wrong derivation path, but the actual key data is correct
    // We need to return it as-is for now, and handle the derivation path correction in descriptor creation
    // TODO: Implement proper key derivation with custom paths when BDK API allows it
    return standardExtendedKey
  } else {
    // For single-sig accounts, use the existing logic
    const externalDescriptor = await getDescriptor(
      key.secret.mnemonic,
      key.scriptVersion,
      KeychainKind.External,
      key.secret.passphrase,
      network
    )
    const extendedKey =
      await extractExtendedKeyFromDescriptor(externalDescriptor)

    return extendedKey
  }
}

async function getDescriptorsFromKeyData(
  extendedPublicKey: string,
  fingerprint: string,
  scriptVersion: NonNullable<Key['scriptVersion']>,
  network: Network,
  isMultisig = false
) {
  // Convert BDK Network to blockchain Network type
  const blockchainNetwork =
    network === Network.Bitcoin
      ? 'bitcoin'
      : network === Network.Testnet
        ? 'testnet'
        : 'signet'

  // Use the correct derivation path based on account type
  const derivationPath = isMultisig
    ? getMultisigDerivationPathFromScriptVersion(
        scriptVersion,
        blockchainNetwork
      )
    : getDerivationPathFromScriptVersion(scriptVersion, blockchainNetwork)

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
    case 'P2SH':
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
  } catch {
    // Return descriptors without checksum if BDK fails
    return {
      externalDescriptor,
      internalDescriptor
    }
  }
}

async function getExtendedPublicKeyFromMnemonic(
  mnemonic: NonNullable<Secret['mnemonic']>,
  passphrase: string = '',
  network: Network,
  scriptVersion?: ScriptVersionType,
  path?: string
) {
  // Convert BDK Network to string for deriveXpubFromMnemonic
  const networkString = network === Network.Bitcoin ? 'mainnet' : 'testnet'

  // If script version is specified and it's a multisig type, use the specific function
  if (
    scriptVersion &&
    ['P2SH', 'P2SH-P2WSH', 'P2WSH'].includes(scriptVersion)
  ) {
    return getXpubForScriptVersion(
      mnemonic,
      passphrase,
      scriptVersion,
      networkString
    )
  }

  // Otherwise, use the default deriveXpubFromMnemonic function
  const result = deriveXpubFromMnemonic(mnemonic, passphrase, {
    network: networkString,
    path
  })

  return result.xpub
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
    const address = receiveAddrInfo?.address
    const receiveAddr = address ? await address.asString() : ''
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

// Get fingerprint for multisig accounts
async function getMultisigFingerprint(
  mnemonic: string,
  passphrase: string = '',
  scriptVersion: ScriptVersionType,
  network: Network
) {
  // Convert BDK Network to string
  const networkString = network === Network.Bitcoin ? 'mainnet' : 'testnet'

  // Get the appropriate derivation path for multisig
  const blockchainNetwork = network === Network.Bitcoin ? 'bitcoin' : 'testnet'
  const derivationPath = getDerivationPathFromScriptVersion(
    scriptVersion,
    blockchainNetwork
  )

  // Extract fingerprint from the extended public key
  // The fingerprint is the first 4 bytes of the parent fingerprint
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  const versions = getVersionsForNetwork(networkString)
  const master = HDKey.fromMasterSeed(seed, versions)

  // Derive to the account level to get the fingerprint
  const pathParts = derivationPath.split('/').slice(1) // Remove 'm' prefix
  let node = master

  for (const part of pathParts) {
    const hardened = part.endsWith("'")
    const index = parseInt(part.replace("'", ''), 10)
    const childIndex = hardened ? index + 0x80000000 : index
    node = node.deriveChild(childIndex)
  }

  return fingerprintToHex(node.fingerprint)
}

// Comprehensive example of how to use multisig functions
async function createMultisigAccountExample(
  mnemonic: string,
  passphrase: string = '',
  scriptVersion: ScriptVersionType,
  network: Network
) {
  try {
    // Convert BDK Network to string
    const networkString = network === Network.Bitcoin ? 'mainnet' : 'testnet'

    // Get the extended public key for the specific script version
    const xpub = await getExtendedPublicKeyFromMnemonic(
      mnemonic,
      passphrase,
      network,
      scriptVersion
    )

    // Get the fingerprint for the account
    const fingerprint = await getMultisigFingerprint(
      mnemonic,
      passphrase,
      scriptVersion,
      network
    )

    // Get the derivation path
    const blockchainNetwork =
      network === Network.Bitcoin ? 'bitcoin' : 'testnet'
    const derivationPath = getDerivationPathFromScriptVersion(
      scriptVersion,
      blockchainNetwork
    )

    // Get all possible extended public keys for comparison
    const allXpubs = getAllXpubs(mnemonic, passphrase, networkString)

    return {
      scriptVersion,
      network: networkString,
      xpub,
      fingerprint,
      derivationPath: `m/${derivationPath}`,
      allXpubs,
      // Example of how to construct a multisig descriptor
      // This would need to be combined with other cosigners' xpubs
      exampleDescriptor: `wsh(multi(2,${xpub},<cosigner2_xpub>,<cosigner3_xpub>))`
    }
  } catch (error) {
    throw new Error(
      `Failed to create multisig account: ${(error as Error).message}`
    )
  }
}

export {
  broadcastTransaction,
  buildTransaction,
  createMultisigAccountExample,
  extractExtendedKeyFromDescriptor,
  extractFingerprintFromExtendedPublicKey,
  generateMnemonic,
  generateMnemonicFromEntropy,
  getBlockchain,
  getDescriptor,
  getDescriptorsFromKeyData,
  getExtendedPublicKeyFromAccountKey,
  getExtendedPublicKeyFromMnemonic,
  getFingerprint,
  getLastUnusedAddressFromWallet,
  getMultisigFingerprint,
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
