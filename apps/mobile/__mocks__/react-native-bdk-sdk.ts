/* eslint-disable */
// Jest mock for react-native-bdk-sdk (native TurboModule can't load in Jest)
// Uses the bip39 JS package to produce real crypto output for test verification.
import * as bip39Js from 'bip39'

export enum Network {
  Bitcoin = 0,
  Testnet = 1,
  Signet = 2,
  Regtest = 3
}

export enum KeychainKind {
  External = 0,
  Internal = 1
}

export enum DescriptorTemplate {
  Bip44 = 0,
  Bip49 = 1,
  Bip84 = 2,
  Bip86 = 3
}

export enum SingleKeyDescriptorTemplate {
  P2Pkh = 0,
  P2Wpkh = 1,
  P2WpkhP2Sh = 2,
  P2tr = 3
}

export enum WordCount {
  Words12 = 0,
  Words15 = 1,
  Words18 = 2,
  Words21 = 3,
  Words24 = 4
}

export enum ChangeSpendPolicy {
  ChangeAllowed = 0,
  OnlyChange = 1,
  ChangeForbidden = 2
}

export enum TxOrdering {
  Shuffle = 0,
  Untouched = 1
}

export enum Language {
  English = 0,
  SimplifiedChinese = 1,
  TraditionalChinese = 2,
  Czech = 3,
  French = 4,
  Italian = 5,
  Japanese = 6,
  Korean = 7,
  Portuguese = 8,
  Spanish = 9
}

const LANGUAGE_TO_WORDLIST_NAME: Record<Language, string> = {
  [Language.English]: 'english',
  [Language.SimplifiedChinese]: 'chinese_simplified',
  [Language.TraditionalChinese]: 'chinese_traditional',
  [Language.Czech]: 'czech',
  [Language.French]: 'french',
  [Language.Italian]: 'italian',
  [Language.Japanese]: 'japanese',
  [Language.Korean]: 'korean',
  [Language.Portuguese]: 'portuguese',
  [Language.Spanish]: 'spanish'
}

const WORD_COUNT_TO_ENTROPY_BITS: Record<WordCount, number> = {
  [WordCount.Words12]: 128,
  [WordCount.Words15]: 160,
  [WordCount.Words18]: 192,
  [WordCount.Words21]: 224,
  [WordCount.Words24]: 256
}

// Free functions
export const addressFromScript = jest.fn(
  (_scriptHex: string, _network: Network) => 'mock-address'
)
export const validateDescriptor = jest.fn(
  (_descriptor: string, _network: Network) => true
)
export const walletNameFromDescriptor = jest.fn(
  (_desc: string, _change: string | undefined, _network: Network) =>
    'mock-wallet-name'
)
export const createWallet = jest.fn()
export const createDescriptor = jest.fn(() => 'mock-descriptor')
export const createDescriptorFromString = jest.fn(() => 'mock-descriptor')
export const createPublicDescriptor = jest.fn(() => 'mock-public-descriptor')
export const createSingleKeyDescriptor = jest.fn(
  () => 'mock-single-key-descriptor'
)
export const exportWallet = jest.fn(() => '{}')
export const isValidAddress = jest.fn(() => true)
export const version = jest.fn(() => '0.0.0')

export class Mnemonic {
  private _mnemonic: string
  private _language: Language

  constructor(wordCount: WordCount) {
    const bits = WORD_COUNT_TO_ENTROPY_BITS[wordCount]
    this._mnemonic = bip39Js.generateMnemonic(bits)
    this._language = Language.English
  }

  static fromString(mnemonic: string): Mnemonic {
    // Try English first, then all languages
    if (bip39Js.validateMnemonic(mnemonic)) {
      const m = Object.create(Mnemonic.prototype) as Mnemonic
      m._mnemonic = mnemonic
      m._language = Language.English
      return m
    }
    for (const [lang, name] of Object.entries(LANGUAGE_TO_WORDLIST_NAME)) {
      const wordlist = bip39Js.wordlists[name]
      if (wordlist && bip39Js.validateMnemonic(mnemonic, wordlist)) {
        const m = Object.create(Mnemonic.prototype) as Mnemonic
        m._mnemonic = mnemonic
        m._language = Number(lang) as Language
        return m
      }
    }
    throw new Error('InvalidMnemonic')
  }

  static fromStringIn(mnemonic: string, language: Language): Mnemonic {
    const name = LANGUAGE_TO_WORDLIST_NAME[language]
    const wordlist = bip39Js.wordlists[name]
    if (!wordlist || !bip39Js.validateMnemonic(mnemonic, wordlist)) {
      throw new Error('InvalidMnemonic')
    }
    const m = Object.create(Mnemonic.prototype) as Mnemonic
    m._mnemonic = mnemonic
    m._language = language
    return m
  }

  static fromEntropy(entropy: Array<number>): Mnemonic {
    const hex = Buffer.from(entropy).toString('hex')
    const m = Object.create(Mnemonic.prototype) as Mnemonic
    m._mnemonic = bip39Js.entropyToMnemonic(hex)
    m._language = Language.English
    return m
  }

  static fromEntropyIn(entropy: Array<number>, language: Language): Mnemonic {
    const hex = Buffer.from(entropy).toString('hex')
    const name = LANGUAGE_TO_WORDLIST_NAME[language]
    const wordlist = bip39Js.wordlists[name]
    const m = Object.create(Mnemonic.prototype) as Mnemonic
    m._mnemonic = bip39Js.entropyToMnemonic(hex, wordlist)
    m._language = language
    return m
  }

  toString(): string {
    return this._mnemonic
  }

  words(): Array<string> {
    return this._mnemonic.split(' ')
  }

  wordCount(): number {
    return this._mnemonic.split(' ').length
  }

  toSeedHex(passphrase: string): string {
    return bip39Js
      .mnemonicToSeedSync(this._mnemonic, passphrase)
      .toString('hex')
  }

  language(): Language {
    return this._language
  }
}

export class Psbt {
  constructor(_base64: string) {}
  toBase64 = jest.fn(() => '')
  extractTxHex = jest.fn(() => '')
  txid = jest.fn(() => '')
  feeAmount = jest.fn(() => 0)
  feeRate = jest.fn(() => 0)
  getUtxoFor = jest.fn(() => undefined)
}

// Number-friendly wrappers (v0.1.6+)
export class BdkWallet {
  constructor(
    _descriptor: string,
    _changeDescriptor: string | undefined,
    _network: Network,
    _dbPath: string
  ) {}
  static fromRaw = jest.fn()
  getBalance = jest.fn(() => ({
    confirmed: 0,
    immature: 0,
    total: 0,
    trustedPending: 0,
    trustedSpendable: 0,
    untrustedPending: 0
  }))
  transactions = jest.fn(() => [])
  listUnspent = jest.fn(() => [])
  listOutput = jest.fn(() => [])
  peekAddress = jest.fn((_keychain: KeychainKind, index: number) => ({
    address: 'mock-address',
    index,
    keychain: _keychain
  }))
  nextUnusedAddress = jest.fn(() => ({
    address: 'mock-address',
    index: 0,
    keychain: KeychainKind.External
  }))
  revealNextAddress = jest.fn(() => ({
    address: 'mock-address',
    index: 0,
    keychain: KeychainKind.External
  }))
  sign = jest.fn(() => true)
  finalizePsbt = jest.fn(() => true)
  persist = jest.fn(() => true)
  syncWithEsplora = jest.fn(() => Promise.resolve())
  syncWithElectrum = jest.fn(() => Promise.resolve())
  fullScanWithEsplora = jest.fn(() => Promise.resolve())
  fullScanWithElectrum = jest.fn(() => Promise.resolve())
  broadcastWithEsplora = jest.fn(() => Promise.resolve('mock-txid'))
  broadcastWithElectrum = jest.fn(() => Promise.resolve('mock-txid'))
  send = jest.fn(() => Promise.resolve('mock-txid'))
  drain = jest.fn(() => Promise.resolve('mock-txid'))
  latestCheckpoint = jest.fn(() => undefined)
  publicDescriptor = jest.fn(() => '')
  descriptorChecksum = jest.fn(() => '')
  isMine = jest.fn(() => false)
  derivationOfSpk = jest.fn(() => undefined)
  network = jest.fn(() => Network.Testnet)
  keychains = jest.fn(() => [])
  policies = jest.fn(() => undefined)
  derivationIndex = jest.fn(() => undefined)
  nextDerivationIndex = jest.fn(() => 0)
  checkpoints = jest.fn(() => [])
  sentAndReceived = jest.fn(() => ({ received: 0, sent: 0 }))
  calculateFee = jest.fn(() => 0)
  calculateFeeRate = jest.fn(() => 0)
  buildFeeBump = jest.fn(() => new Psbt(''))
  getTx = jest.fn(() => undefined)
  getUtxo = jest.fn(() => undefined)
  txDetails = jest.fn(() => undefined)
}

export class BdkTxBuilder {
  addRecipient = jest.fn()
  setRecipients = jest.fn()
  addData = jest.fn()
  addUtxo = jest.fn()
  addUtxos = jest.fn()
  manuallySelectedOnly = jest.fn()
  feeAbsolute = jest.fn()
  feeRate = jest.fn()
  enableRbf = jest.fn()
  enableRbfWithSequence = jest.fn()
  drainWallet = jest.fn()
  drainTo = jest.fn()
  finish = jest.fn(() => Promise.resolve(new Psbt('')))
}

export class BdkElectrumClient {
  constructor(_url: string) {}
  get raw() {
    return {}
  }
}

export const bdkCreateWallet = jest.fn(() =>
  Promise.resolve(new BdkWallet('', undefined, Network.Testnet, ''))
)

// Keep raw classes for backward compatibility
export class TxBuilder {
  addRecipient = jest.fn()
  addUtxo = jest.fn()
  addUtxos = jest.fn()
  manuallySelectedOnly = jest.fn()
  feeAbsolute = jest.fn()
  feeRate = jest.fn()
  enableRbf = jest.fn()
  finish = jest.fn(() => Promise.resolve(new Psbt('')))
}

export class ElectrumClient {
  constructor(_url: string) {}
}

export class Wallet {
  constructor(
    _descriptor: string,
    _changeDescriptor: string | undefined,
    _network: Network,
    _dbPath: string
  ) {}
}
