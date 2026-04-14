import { hmac } from '@noble/hashes/hmac'
import { pbkdf2Async } from '@noble/hashes/pbkdf2'
import { sha512 } from '@noble/hashes/sha512'
import { HDKey } from '@scure/bip32'
// Wordlists are static data imported directly from bip39 JSON files.
import chineseSimplified from 'bip39/src/wordlists/chinese_simplified.json'
import chineseTraditional from 'bip39/src/wordlists/chinese_traditional.json'
import czech from 'bip39/src/wordlists/czech.json'
import english from 'bip39/src/wordlists/english.json'
import french from 'bip39/src/wordlists/french.json'
import italian from 'bip39/src/wordlists/italian.json'
import japanese from 'bip39/src/wordlists/japanese.json'
import korean from 'bip39/src/wordlists/korean.json'
import portuguese from 'bip39/src/wordlists/portuguese.json'
import spanish from 'bip39/src/wordlists/spanish.json'
import {
  type KeychainKind,
  Language,
  Mnemonic,
  Network,
  WordCount
} from 'react-native-bdk-sdk'

import type {
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

export const DEFAULT_WORD_LIST: WordListName = 'english'

const WORDLISTS: Record<WordListName, string[]> = {
  chinese_simplified: chineseSimplified,
  chinese_traditional: chineseTraditional,
  czech,
  english,
  french,
  italian,
  japanese,
  korean,
  portuguese,
  spanish
}

const LANGUAGE_MAP: Record<WordListName, Language> = {
  chinese_simplified: Language.SimplifiedChinese,
  chinese_traditional: Language.TraditionalChinese,
  czech: Language.Czech,
  english: Language.English,
  french: Language.French,
  italian: Language.Italian,
  japanese: Language.Japanese,
  korean: Language.Korean,
  portuguese: Language.Portuguese,
  spanish: Language.Spanish
}

const WORD_COUNT_MAP: Record<MnemonicWordCount, WordCount> = {
  12: WordCount.Words12,
  15: WordCount.Words15,
  18: WordCount.Words18,
  21: WordCount.Words21,
  24: WordCount.Words24
}

const WORD_COUNT_TO_ENTROPY_BYTES: Record<MnemonicWordCount, number> = {
  12: 16,
  15: 20,
  18: 24,
  21: 28,
  24: 32
}

export function getWordList(name: WordListName = DEFAULT_WORD_LIST) {
  return WORDLISTS[name]
}

export function validateMnemonic(mnemonic: string, wordListName = 'english') {
  const language = LANGUAGE_MAP[wordListName as WordListName]
  if (!language && language !== 0) {
    return false
  }
  try {
    Mnemonic.fromStringIn(mnemonic, language)
    return true
  } catch {
    return false
  }
}

// From ElectrumMnemonicCode.java: prefixLength = parseInt(hex[0]) + 2
// Valid prefixes: "01" (standard), "100" (segwit), "101" (2fa-standard)
const ELECTRUM_SEED_VERSIONS: Record<string, string> = {
  '01': 'standard',
  '100': 'segwit',
  '101': '2fa-standard'
}

const enc = new TextEncoder()

export function detectElectrumSeed(mnemonic: string): string | null {
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
    if (isNaN(firstDigit)) {
      return null
    }
    const prefixLength = firstDigit + 2
    const prefixSlice = hmacHex.slice(0, prefixLength).toLowerCase()
    return ELECTRUM_SEED_VERSIONS[prefixSlice] ?? null
  } catch {
    return null
  }
}

// Electrum seed derivation: PBKDF2(HMAC-SHA512, pass=NFKD(mnemonic), salt="electrum"+NFKD(passphrase), rounds=2048)
export function mnemonicToSeedElectrum(
  mnemonic: string,
  passphrase = ''
): Promise<Uint8Array> {
  const normalizedMnemonic = mnemonic
    .normalize('NFKD')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
  const salt = `electrum${passphrase}`.normalize('NFKD')
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
  '2fa-standard': 'P2PKH',
  segwit: 'P2WPKH',
  standard: 'P2PKH'
}

export async function getPrivateDescriptorFromElectrumMnemonic(
  mnemonic: string,
  electrumType: string,
  kind: KeychainKind,
  passphrase: string,
  network: Network
): Promise<string> {
  const seed = await mnemonicToSeedElectrum(mnemonic, passphrase)
  const scriptVersion = ELECTRUM_SCRIPT_VERSION[electrumType] ?? 'P2WPKH'
  // Strip leading "m/" — descriptor path format is just "0'" not "m/0'"
  const path = getElectrumDerivationPath(electrumType).replace(/^m\/?/, '')
  return getPrivateDescriptorFromSeedWithPath(
    seed,
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
  if (wordListName === 'english') {
    return new Mnemonic(WORD_COUNT_MAP[wordCount]).toString()
  }
  const language = LANGUAGE_MAP[wordListName as WordListName]
  const entropySize = WORD_COUNT_TO_ENTROPY_BYTES[wordCount]
  const entropy = new Uint8Array(entropySize)
  crypto.getRandomValues(entropy)
  return Mnemonic.fromEntropyIn(Array.from(entropy), language).toString()
}

function binaryStringToBytes(binary: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < binary.length; i += 8) {
    bytes.push(parseInt(binary.slice(i, i + 8), 2))
  }
  return bytes
}

export function generateMnemonicFromEntropy(
  entropy: string,
  wordListName = 'english'
) {
  if (entropy.length < 128 || entropy.length > 256) {
    throw new Error('Invalid Entropy: it must be range of [128, 256]')
  }
  if (entropy.length % 32 !== 0) {
    throw new Error('Invalid Entropy: it must be divisible by 32')
  }
  const language =
    LANGUAGE_MAP[wordListName as WordListName] ?? Language.English
  const bytes = binaryStringToBytes(entropy)
  return Mnemonic.fromEntropyIn(bytes, language).toString()
}

export function mnemonicToSeed(mnemonic: string, passphrase = ''): Uint8Array {
  const m = Mnemonic.fromString(mnemonic)
  const seedHex = m.toSeedHex(passphrase)
  return new Uint8Array(Buffer.from(seedHex, 'hex'))
}

export function getPublicDescriptorFromMnemonic(
  mnemonic: string,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  passphrase: string | undefined,
  network: Network
): string {
  const seed = mnemonicToSeed(mnemonic, passphrase ?? '')
  return getPublicDescriptorFromSeed(seed, scriptVersion, kind, network)
}

export function getPrivateDescriptorFromMnemonic(
  mnemonic: string,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  passphrase: string | undefined,
  network: Network
): string {
  const seed = mnemonicToSeed(mnemonic, passphrase ?? '')
  return getPrivateDescriptorFromSeed(seed, scriptVersion, kind, network)
}

export function getFingerprintFromMnemonic(
  mnemonic: string,
  passphrase: Secret['passphrase'] = undefined
) {
  const seed = mnemonicToSeed(mnemonic, passphrase ?? '')
  return getFingerprintFromSeed(seed)
}

export function getExtendedPublicKeyFromMnemonic(
  mnemonic: string,
  passphrase: string,
  network: Network,
  scriptVersion: ScriptVersionType
) {
  const seed = mnemonicToSeed(mnemonic, passphrase)
  return getExtendedPublicKeyFromSeed(seed, network, scriptVersion)
}
/** Parse BIP32 path like "m/48'/0'/0'/2'" -> array of indexes (with hardened offset) */
function parsePath(path: string): number[] {
  if (!path || path === 'm') {
    return []
  }

  const parts = path.split('/')
  if (parts[0] !== 'm') {
    throw new Error('Derivation path must start with "m"')
  }

  const HARDENED_OFFSET = 0x80000000 // replace HDKey.HARDENED_OFFSET

  const items = parts.slice(1).map((p: string) => {
    const hardened = /('|h|H)$/.test(p)
    const index = parseInt(p.replace(/['hH]/, ''), 10)
    if (Number.isNaN(index)) {
      throw new TypeError(`Invalid path segment: ${p}`)
    }
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
  passphrase: string,
  opts: DeriveOptions = {}
) {
  const network: 'mainnet' | 'testnet' =
    opts.network === 'testnet' ? 'testnet' : 'mainnet'

  // default BIP48 P2WSH path
  const coinType = network === 'mainnet' ? 0 : 1
  const defaultPath = `m/48'/${coinType}'/0'/2'`
  const path = opts.path || defaultPath

  const seed = mnemonicToSeed(mnemonic, passphrase)

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

  for (const [i, index] of indices.entries()) {
    node = node.deriveChild(index)

    if (i === 2) {
      parentFingerprint = node.fingerprint
    }

    steps.push({
      depth: node.depth,
      fingerprint: fingerprintToHex(node.fingerprint),
      index,
      parentFingerprint: fingerprintToHex(node.parentFingerprint || 0),
      publicExtendedKey: node.publicExtendedKey
    })
  }

  const accountXpub = node.publicExtendedKey

  return {
    masterFingerprint: masterFingerprintHex,
    masterPubkeyHex,
    network,
    parentFingerprint: fingerprintToHex(parentFingerprint),
    path,
    steps,
    xpub: accountXpub
  }
}

function getExtendedPublicKeyFromMnemonicCustom(
  mnemonic: NonNullable<Secret['mnemonic']>,
  passphrase: string,
  network: Network,
  scriptVersion?: ScriptVersionType,
  path?: string,
  isMultisig = false
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
      default:
        break
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
