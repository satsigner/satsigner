/* eslint-disable */
// Jest mock for react-native-bdk-sdk (native TurboModule can't load in Jest)

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
  English = 0
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
  static fromString = jest.fn(() => new Mnemonic(WordCount.Words12))
  static fromEntropy = jest.fn(() => new Mnemonic(WordCount.Words12))
  constructor(_wordCount: WordCount) {}
  toString = jest.fn(() => 'mock mnemonic words')
  words = jest.fn(() => [])
  wordCount = jest.fn(() => 12)
  toSeedHex = jest.fn(() => '00'.repeat(64))
  language = jest.fn(() => Language.English)
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
