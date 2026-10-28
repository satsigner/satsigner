import {
  sampleSignetAddress,
  sampleSignetWalletSeed,
  sampleSignetXpubFingerprint
} from '@/constants/samples'
import type { Account, Key } from '@/types/models/Account'
import { getFingerprintFromMnemonic } from '@/utils/bip39'
import { isSampleWalletLoaded } from '@/utils/sampleWallet'

const sampleSeedFingerprint = getFingerprintFromMnemonic(sampleSignetWalletSeed)

function makeKey(overrides: Partial<Key> = {}): Key {
  return {
    creationType: 'importMnemonic',
    index: 0,
    iv: '',
    secret: 'encrypted',
    ...overrides
  }
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    addresses: [],
    createdAt: new Date('2024-01-01'),
    displayIndex: 0,
    id: 'acc-1',
    keyCount: 1,
    keys: [
      makeKey({ fingerprint: sampleSeedFingerprint, scriptVersion: 'P2WPKH' })
    ],
    keysRequired: 1,
    labels: {},
    name: 'Renamed sample',
    network: 'signet',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      deviceNpub: '',
      deviceNsec: '',
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

describe('isSampleWalletLoaded', () => {
  it('finds a renamed key sample by its fingerprint and script version', () => {
    expect(isSampleWalletLoaded('segwit', 'signet', [makeAccount()], {})).toBe(
      true
    )
  })

  it('tells the segwit and legacy samples of one seed apart', () => {
    expect(isSampleWalletLoaded('legacy', 'signet', [makeAccount()], {})).toBe(
      false
    )
  })

  it('compares fingerprints case-insensitively', () => {
    const account = makeAccount({
      keys: [
        makeKey({
          creationType: 'importExtendedPub',
          fingerprint: sampleSignetXpubFingerprint.toUpperCase(),
          scriptVersion: 'P2PKH'
        })
      ],
      policyType: 'watchonly'
    })
    expect(isSampleWalletLoaded('watchonlyXpub', 'signet', [account], {})).toBe(
      true
    )
  })

  it('ignores the sample on another network', () => {
    expect(isSampleWalletLoaded('segwit', 'testnet', [makeAccount()], {})).toBe(
      false
    )
  })

  it('finds an address sample by its watched address', () => {
    const account = makeAccount({
      keys: [makeKey({ creationType: 'importAddress' })],
      policyType: 'watchonly'
    })
    expect(
      isSampleWalletLoaded('watchonlyAddress', 'signet', [account], {
        [account.id]: sampleSignetAddress
      })
    ).toBe(true)
  })

  it('finds an address sample by its synced addresses', () => {
    const account = makeAccount({
      addresses: [
        {
          address: sampleSignetAddress,
          label: '',
          summary: {
            balance: 0,
            satsInMempool: 0,
            transactions: 0,
            utxos: 0
          },
          transactions: [],
          utxos: []
        }
      ],
      keys: [makeKey({ creationType: 'importAddress' })],
      policyType: 'watchonly'
    })
    expect(
      isSampleWalletLoaded('watchonlyAddress', 'signet', [account], {})
    ).toBe(true)
  })

  it('does not match a different address sample', () => {
    const account = makeAccount({
      keys: [makeKey({ creationType: 'importAddress' })],
      policyType: 'watchonly'
    })
    expect(
      isSampleWalletLoaded('watchonlySalvador', 'signet', [account], {
        [account.id]: sampleSignetAddress
      })
    ).toBe(false)
  })
})
