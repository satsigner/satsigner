import { Network } from 'react-native-bdk-sdk'

import {
  buildTransactionWithRpc,
  getPublicDescriptorsForAccount,
  resolveRpcWalletName
} from '@/api/bdk'
import { BitcoinCoreWallet } from '@/api/rpc'
import type { Account, Key } from '@/types/models/Account'
import type { Output } from '@/types/models/Output'
import type { Utxo } from '@/types/models/Utxo'
import type { RpcCredentials } from '@/types/settings/blockchain'

// utils/bip39.ts imports @noble/hashes subpaths (e.g. '@noble/hashes/hmac')
// using the v1.x export map, but a hoisted v2.x copy is resolved at the repo
// root in this workspace, which renamed/restructured those subpaths and
// breaks module resolution under Jest. None of the tests in this file
// exercise the mnemonic-derived code paths, so the real module is replaced
// with lightweight stubs purely to keep `@/api/bdk`'s module graph loadable.
jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

// @/api/electrum pulls in react-native-tcp-socket, whose native
// NativeEventEmitter setup can't run under Jest. None of the tests in this
// file exercise the Electrum sync path, so it is replaced with a stub.
jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  default: {} as unknown as typeof import('@/api/electrum').default
}))

function makeKey(overrides: Partial<Key> = {}): Key {
  return {
    creationType: 'generateMnemonic',
    index: 0,
    iv: '',
    secret: '',
    ...overrides
  }
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    id: 'acc-1',
    keyCount: 1,
    keys: [makeKey()],
    keysRequired: 1,
    labels: {},
    name: 'Test',
    network: 'bitcoin',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    },
    policyType: 'singlesig',
    summary: {
      balance: 0,
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: [],
    ...overrides
  }
}

function makeUtxo(overrides: Partial<Utxo> = {}): Utxo {
  return {
    keychain: 'external',
    txid: 'a'.repeat(64),
    value: 0,
    vout: 0,
    ...overrides
  }
}

function makeOutput(overrides: Partial<Output> = {}): Output {
  return {
    amount: 0,
    label: '',
    localId: 'out-1',
    to: 'addr',
    ...overrides
  }
}

describe('resolveRpcWalletName', () => {
  it('prefers the user-provided wallet name, trimmed', () => {
    const account = makeAccount({
      keys: [makeKey({ fingerprint: 'abcd1234' })]
    })
    expect(resolveRpcWalletName(account, '  my-core-wallet  ')).toBe(
      'my-core-wallet'
    )
  })

  it('falls back to a deterministic name from the key fingerprint', () => {
    const account = makeAccount({
      keys: [makeKey({ fingerprint: 'abcd1234' })]
    })
    expect(resolveRpcWalletName(account, undefined)).toBe('satsigner-abcd1234')
  })

  it('treats a blank/whitespace-only override as unset', () => {
    const account = makeAccount({
      keys: [makeKey({ fingerprint: 'abcd1234' })]
    })
    expect(resolveRpcWalletName(account, '   ')).toBe('satsigner-abcd1234')
  })

  it('falls back to the account id when no key fingerprint is available', () => {
    const account = makeAccount({ id: 'acc-xyz', keys: [makeKey()] })
    expect(resolveRpcWalletName(account, undefined)).toBe('satsigner-acc-xyz')
  })
})

describe('getPublicDescriptorsForAccount', () => {
  it('returns null when the account has no keys', () => {
    const account = makeAccount({ keys: [] })
    expect(getPublicDescriptorsForAccount(account, Network.Testnet)).toBeNull()
  })

  it('returns the imported descriptors verbatim when they are public-only', () => {
    const account = makeAccount({
      keys: [
        makeKey({
          creationType: 'importDescriptor',
          secret: {
            externalDescriptor: 'wpkh([abcd1234/84h/1h/0h]tpub.../0/*)',
            internalDescriptor: 'wpkh([abcd1234/84h/1h/0h]tpub.../1/*)'
          }
        })
      ]
    })

    const result = getPublicDescriptorsForAccount(account, Network.Testnet)

    expect(result).toStrictEqual([
      'wpkh([abcd1234/84h/1h/0h]tpub.../0/*)',
      'wpkh([abcd1234/84h/1h/0h]tpub.../1/*)'
    ])
  })

  it('returns null when the imported descriptor is missing its internal half', () => {
    const account = makeAccount({
      keys: [
        makeKey({
          creationType: 'importDescriptor',
          secret: {
            externalDescriptor: 'wpkh([abcd1234/84h/1h/0h]tpub.../0/*)'
          }
        })
      ]
    })

    expect(getPublicDescriptorsForAccount(account, Network.Testnet)).toBeNull()
  })

  // Regression test for a private-key leak: imported descriptors carrying
  // xprv/tprv/etc. must never be forwarded to a remote Bitcoin Core node.
  it.each(['xprv', 'tprv', 'yprv', 'uprv', 'zprv', 'vprv'])(
    'refuses to derive descriptors when the external descriptor embeds a %s key',
    (prefix) => {
      const account = makeAccount({
        keys: [
          makeKey({
            creationType: 'importDescriptor',
            secret: {
              externalDescriptor: `wpkh([abcd1234/84h/1h/0h]${prefix}Kf9.../0/*)`,
              internalDescriptor: `wpkh([abcd1234/84h/1h/0h]${prefix}Kf9.../1/*)`
            }
          })
        ]
      })

      expect(() =>
        getPublicDescriptorsForAccount(account, Network.Testnet)
      ).toThrow(/private key material/)
    }
  )

  it('refuses to derive descriptors when only the internal descriptor embeds a private key', () => {
    const account = makeAccount({
      keys: [
        makeKey({
          creationType: 'importDescriptor',
          secret: {
            externalDescriptor: 'wpkh([abcd1234/84h/1h/0h]tpub.../0/*)',
            internalDescriptor: 'wpkh([abcd1234/84h/1h/0h]tprv9.../1/*)'
          }
        })
      ]
    })

    expect(() =>
      getPublicDescriptorsForAccount(account, Network.Testnet)
    ).toThrow(/private key material/)
  })

  it('detects private key prefixes case-insensitively', () => {
    const account = makeAccount({
      keys: [
        makeKey({
          creationType: 'importDescriptor',
          secret: {
            externalDescriptor: 'wpkh([abcd1234/84h/1h/0h]XPRV9.../0/*)',
            internalDescriptor: 'wpkh([abcd1234/84h/1h/0h]XPRV9.../1/*)'
          }
        })
      ]
    })

    expect(() =>
      getPublicDescriptorsForAccount(account, Network.Testnet)
    ).toThrow(/private key material/)
  })

  it('returns null for creation types it does not know how to derive from (e.g. importAddress)', () => {
    const account = makeAccount({
      keys: [makeKey({ creationType: 'importAddress' })]
    })
    expect(getPublicDescriptorsForAccount(account, Network.Testnet)).toBeNull()
  })
})

describe('buildTransactionWithRpc', () => {
  const NODE_URL = 'http://127.0.0.1:8332'
  const CREDENTIALS: RpcCredentials = { password: 'pass', username: 'user' }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends each output as its own single-key object, preserving duplicate addresses', async () => {
    const createPsbtSpy = jest
      .spyOn(BitcoinCoreWallet.prototype, 'createPsbt')
      .mockResolvedValue('cHNidA==')
    jest
      .spyOn(BitcoinCoreWallet.prototype, 'walletProcessPsbt')
      .mockResolvedValue({ complete: true, psbt: 'cHNidA==' })

    const sameAddress = 'bcrt1qexampleexampleexampleexampleexamplex'
    await buildTransactionWithRpc(NODE_URL, CREDENTIALS, 'wallet-1', {
      inputs: [makeUtxo()],
      options: { rbf: false },
      outputs: [
        makeOutput({ amount: 50_000, to: sameAddress }),
        makeOutput({ amount: 25_000, to: sameAddress })
      ]
    })

    expect(createPsbtSpy).toHaveBeenCalledTimes(1)
    const [[, outputs]] = createPsbtSpy.mock.calls
    // Two distinct array entries, not merged into one object keyed by address —
    // otherwise the second amount would silently clobber the first.
    expect(outputs).toStrictEqual([
      { [sameAddress]: 0.0005 },
      { [sameAddress]: 0.00025 }
    ])
  })

  it('converts sats to BTC precisely, avoiding float summation artifacts', async () => {
    const createPsbtSpy = jest
      .spyOn(BitcoinCoreWallet.prototype, 'createPsbt')
      .mockResolvedValue('cHNidA==')
    jest
      .spyOn(BitcoinCoreWallet.prototype, 'walletProcessPsbt')
      .mockResolvedValue({ complete: true, psbt: 'cHNidA==' })

    await buildTransactionWithRpc(NODE_URL, CREDENTIALS, 'wallet-1', {
      inputs: [],
      options: { rbf: false },
      outputs: [makeOutput({ amount: 1, to: 'addr1' })]
    })

    const [[, outputs]] = createPsbtSpy.mock.calls
    expect(outputs).toStrictEqual([{ addr1: 0.00000001 }])
  })

  it('marks inputs with the RBF sequence number when rbf is enabled', async () => {
    const createPsbtSpy = jest
      .spyOn(BitcoinCoreWallet.prototype, 'createPsbt')
      .mockResolvedValue('cHNidA==')
    jest
      .spyOn(BitcoinCoreWallet.prototype, 'walletProcessPsbt')
      .mockResolvedValue({ complete: true, psbt: 'cHNidA==' })

    const txid = 'b'.repeat(64)
    await buildTransactionWithRpc(NODE_URL, CREDENTIALS, 'wallet-1', {
      inputs: [makeUtxo({ txid, vout: 2 })],
      options: { rbf: true },
      outputs: [makeOutput({ amount: 1000, to: 'addr1' })]
    })

    const [[inputs]] = createPsbtSpy.mock.calls
    expect(inputs).toStrictEqual([{ sequence: 0xfffffffd, txid, vout: 2 }])
  })

  it('enriches the PSBT via walletprocesspsbt without attempting to sign it', async () => {
    jest
      .spyOn(BitcoinCoreWallet.prototype, 'createPsbt')
      .mockResolvedValue('unsigned-psbt-base64')
    const walletProcessPsbtSpy = jest
      .spyOn(BitcoinCoreWallet.prototype, 'walletProcessPsbt')
      .mockResolvedValue({ complete: false, psbt: 'processed-psbt-base64' })

    await buildTransactionWithRpc(NODE_URL, CREDENTIALS, 'wallet-1', {
      inputs: [],
      options: { rbf: false },
      outputs: [makeOutput({ amount: 1000, to: 'addr1' })]
    })

    expect(walletProcessPsbtSpy).toHaveBeenCalledWith('unsigned-psbt-base64')
  })
})
