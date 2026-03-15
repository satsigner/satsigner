import { hmac } from '@noble/hashes/hmac'
import { pbkdf2Async } from '@noble/hashes/pbkdf2'
import { sha512 } from '@noble/hashes/sha512'
import { HDKey } from '@scure/bip32'
import type { KeychainKind } from 'bdk-rn/lib/lib/enums'
import { Network } from 'bdk-rn/lib/lib/enums'
import * as bip39 from 'bip39'

import type {
  MnemonicEntropyBits,
  MnemonicWordCount,
  ScriptVersionType,
  Secret
} from '@/types/models/Account'
import {
  fingerprintToHex,
  getExtendedPublicKeyFromSeed,
  getFingerprintFromSeed,
  getPrivateDescriptorFromSeed,
  getPrivateDescriptorFromSeedWithPath,
  getPublicDescriptorFromSeed,
  getVersionsForNetwork,
  getXpubForScriptVersion,
  toHex
} from '@/utils/bip32'

export const WORDLIST_LIST = [
  'chinese_simplified',
  'chinese_traditional',
  'czech',
  'english',
  'french',
  'italian',
  'japanese',
  'korean',
  'portuguese',
  'spanish'
] as const

export type WordListName = (typeof WORDLIST_LIST)[number]

export const DEFAULT_WORD_LIST = bip39.getDefaultWordlist() as WordListName

const wordCountToEntropyBits: Record<MnemonicWordCount, MnemonicEntropyBits> = {
  12: 128,
  15: 160,
  18: 192,
  21: 224,
  24: 256
}

export function getWordList(name: WordListName = DEFAULT_WORD_LIST) {
  return bip39.wordlists[name]
}

export function validateMnemonic(
  mnemonic: string,
  wordListName: string = 'english'
) {
  const wordlist = bip39.wordlists[wordListName]
  return bip39.validateMnemonic(mnemonic, wordlist)
}

// From ElectrumMnemonicCode.java: prefixLength = parseInt(hex[0]) + 2
// Valid prefixes: "01" (standard), "100" (segwit), "101" (2fa-standard)
const ELECTRUM_SEED_VERSIONS: Record<string, string> = {
  '01': 'standard',
  '100': 'segwit',
  '101': '2fa-standard'
}

const enc = new TextEncoder()

export async function detectElectrumSeed(
  mnemonic: string
): Promise<string | null> {
  const normalized = mnemonic
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
  try {
    const result = hmac(
      sha512,
      enc.encode('Seed version'),
      enc.encode(normalized)
    )
    const hmacHex = Buffer.from(result).toString('hex')
    const firstDigit = parseInt(hmacHex[0], 16)
    if (isNaN(firstDigit)) return null
    const prefixLength = firstDigit + 2
    const prefixSlice = hmacHex.slice(0, prefixLength).toLowerCase()
    return ELECTRUM_SEED_VERSIONS[prefixSlice] ?? null
  } catch {
    return null
  }
}

// Electrum seed derivation: PBKDF2(HMAC-SHA512, pass=NFKD(mnemonic), salt="electrum"+NFKD(passphrase), rounds=2048)
export async function mnemonicToSeedElectrum(
  mnemonic: string,
  passphrase: string = ''
): Promise<Uint8Array> {
  const normalizedMnemonic = mnemonic
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
  const salt = ('electrum' + passphrase).normalize('NFKD')
  return pbkdf2Async(sha512, enc.encode(normalizedMnemonic), enc.encode(salt), {
    c: 2048,
    dkLen: 64
  })
}

// Electrum derivation paths by seed type (from Sparrow's Electrum.java)
export function getElectrumDerivationPath(seedType: string): string {
  return seedType === 'segwit' ? "m/0'" : 'm'
}

// Matches m, m/0', m/0h — the only paths used by Electrum seeds
export function isElectrumDerivationPath(path: string): boolean {
  return /^m(\/0[h'])?$/.test(path)
}

// scriptVersion for Electrum seed type: segwit → P2WPKH, standard → P2PKH
const ELECTRUM_SCRIPT_VERSION: Record<string, ScriptVersionType> = {
  segwit: 'P2WPKH',
  standard: 'P2PKH',
  '2fa-standard': 'P2PKH'
}

export async function getPrivateDescriptorFromElectrumMnemonic(
  mnemonic: string,
  electrumType: string,
  kind: KeychainKind,
  passphrase: string = '',
  network: Network
): Promise<string> {
  const seed = await mnemonicToSeedElectrum(mnemonic, passphrase)
  const scriptVersion = ELECTRUM_SCRIPT_VERSION[electrumType] ?? 'P2WPKH'
  // Strip leading "m/" — descriptor path format is just "0'" not "m/0'"
  const path = getElectrumDerivationPath(electrumType).replace(/^m\/?/, '')
  return getPrivateDescriptorFromSeedWithPath(
    Buffer.from(seed),
    scriptVersion,
    kind,
    network,
    path
  )
}

export function generateMnemonic(
  wordCount: MnemonicWordCount = 12,
  wordListName = 'english'
) {
  const entropyBits = wordCountToEntropyBits[wordCount]
  const wordlist = bip39.wordlists[wordListName]
  const mnemonic = bip39.generateMnemonic(entropyBits, undefined, wordlist)
  return mnemonic
}

export function generateMnemonicFromEntropy(
  entropy: string,
  wordListName: string = 'english'
) {
  if (entropy.length < 128 || entropy.length > 256)
    throw new Error('Invalid Entropy: it must be range of [128, 256]')
  if (entropy.length % 32 !== 0)
    throw new Error('Invalid Entropy: it must be divisible by 32')
  const wordlist = bip39.wordlists[wordListName]
  return bip39.entropyToMnemonic(entropy, wordlist)
}

export function getEntropyFromMnemonic(
  mnemonic: string,
  wordListName: WordListName = 'english'
) {
  const entropyHexString = bip39.mnemonicToEntropy(
    mnemonic,
    bip39.wordlists[wordListName]
  )
  const entropyHexBytes = entropyHexString.match(/../g) as string[]
  const entropyNumbers = entropyHexBytes.map((hex) => parseInt(hex, 16))
  return entropyNumbers
}

export function getPublicDescriptorFromMnemonic(
  mnemonic: string,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  passphrase: string | undefined,
  network: Network
): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  return getPublicDescriptorFromSeed(seed, scriptVersion, kind, network)
}

export function getPrivateDescriptorFromMnemonic(
  mnemonic: string,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  passphrase: string | undefined,
  network: Network
): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  return getPrivateDescriptorFromSeed(seed, scriptVersion, kind, network)
}

export function getFingerprintFromMnemonic(
  mnemonic: string,
  passphrase: Secret['passphrase'] = undefined
) {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  return getFingerprintFromSeed(seed)
}

export function getExtendedPublicKeyFromMnemonic(
  mnemonic: string,
  passphrase: string = '',
  network: Network,
  scriptVersion: ScriptVersionType
) {
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase)
  return getExtendedPublicKeyFromSeed(seed, network, scriptVersion)
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

function getExtendedPublicKeyFromMnemonicCustom(
  mnemonic: NonNullable<Secret['mnemonic']>,
  passphrase: string = '',
  network: Network,
  scriptVersion?: ScriptVersionType,
  path?: string,
  isMultisig: boolean = false
) {
  // Convert BDK Network to string for deriveXpubFromMnemonic
  const networkString = network === Network.Bitcoin ? 'mainnet' : 'testnet'

  // If script version is specified and it's a multisig type, use the specific function
  if (
    scriptVersion &&
    isMultisig &&
    [
      'P2SH',
      'P2SH-P2WSH',
      'P2WSH',
      'P2WPKH',
      'P2PKH',
      'P2SH-P2WPKH',
      'P2TR'
    ].includes(scriptVersion)
  ) {
    return getXpubForScriptVersion(
      mnemonic,
      passphrase,
      scriptVersion,
      networkString
    )
  }

  // For singlesig accounts, use the correct BIP derivation paths
  let derivationPath = path
  if (!path && !isMultisig) {
    const coinType = networkString === 'mainnet' ? '0' : '1'
    switch (scriptVersion) {
      case 'P2PKH':
        derivationPath = `m/44'/${coinType}'/0'` // BIP44
        break
      case 'P2SH-P2WPKH':
        derivationPath = `m/49'/${coinType}'/0'` // BIP49
        break
      case 'P2WPKH':
        derivationPath = `m/84'/${coinType}'/0'` // BIP84
        break
      case 'P2TR':
        derivationPath = `m/86'/${coinType}'/0'` // BIP86
        break
      // P2WSH, P2SH-P2WSH, P2SH are typically multisig only
    }
  }

  // Otherwise, use the default deriveXpubFromMnemonic function
  const result = deriveXpubFromMnemonic(mnemonic, passphrase, {
    network: networkString,
    path: derivationPath
  })

  return result.xpub
}

export { getExtendedPublicKeyFromMnemonicCustom }
