import type { Account, Key, Secret } from '@/types/models/Account'
import {
  checkWalletNeedsSync,
  dropSeedFromKeyInMemory,
  getAccountFingerprint,
  updateAccountObjectLabels
} from '@/utils/account'

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

describe('dropSeedFromKeyInMemory', () => {
  it('strips mnemonic and passphrase from secret', () => {
    const secret: Secret = {
      extendedPublicKey: 'xpub123',
      externalDescriptor: 'wpkh([abc/84h/0h/0h]xpub...)',
      fingerprint: 'abcdef12',
      internalDescriptor: 'wpkh([abc/84h/0h/0h]xpub.../1/*)',
      mnemonic:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      passphrase: 'test'
    }
    const key = makeKey({ secret })
    const result = dropSeedFromKeyInMemory(key)

    expect(result.secret).toStrictEqual({
      extendedPublicKey: 'xpub123',
      externalDescriptor: 'wpkh([abc/84h/0h/0h]xpub...)',
      fingerprint: 'abcdef12',
      internalDescriptor: 'wpkh([abc/84h/0h/0h]xpub.../1/*)'
    })
    expect((result.secret as Secret).mnemonic).toBeUndefined()
    expect((result.secret as Secret).passphrase).toBeUndefined()
  })

  it('preserves key metadata', () => {
    const key = makeKey({
      creationType: 'importMnemonic',
      derivationPath: "m/84'/0'/0'",
      fingerprint: 'fp123',
      index: 2,
      iv: 'some-iv',
      name: 'Key 3',
      secret: { fingerprint: 'fp123' }
    })
    const result = dropSeedFromKeyInMemory(key)

    expect(result.index).toBe(2)
    expect(result.name).toBe('Key 3')
    expect(result.creationType).toBe('importMnemonic')
    expect(result.fingerprint).toBe('fp123')
    expect(result.derivationPath).toBe("m/84'/0'/0'")
    expect(result.iv).toBe('some-iv')
  })

  it('throws when secret is a string (encrypted)', () => {
    const key = makeKey({ secret: 'encrypted-string' })
    expect(() => dropSeedFromKeyInMemory(key)).toThrow(
      'Expected unencrypted secret object'
    )
  })

  it('handles secret with no mnemonic (watch-only)', () => {
    const secret: Secret = {
      externalDescriptor: 'wpkh(xpub...)',
      fingerprint: 'abcd1234'
    }
    const key = makeKey({ secret })
    const result = dropSeedFromKeyInMemory(key)

    expect(result.secret).toStrictEqual({
      extendedPublicKey: undefined,
      externalDescriptor: 'wpkh(xpub...)',
      fingerprint: 'abcd1234',
      internalDescriptor: undefined
    })
  })

  it('does not mutate original key', () => {
    const secret: Secret = { fingerprint: 'fp', mnemonic: 'word word word' }
    const key = makeKey({ secret })
    dropSeedFromKeyInMemory(key)

    expect((key.secret as Secret).mnemonic).toBe('word word word')
  })
})

describe('getAccountFingerprint', () => {
  it('returns fingerprint from key metadata', () => {
    const account = makeAccount({
      keys: [makeKey({ fingerprint: 'abcdef12' })]
    })
    expect(getAccountFingerprint(account)).toBe('abcdef12')
  })

  it('returns fingerprint from decrypted secret', () => {
    const account = makeAccount({
      keys: [makeKey({ secret: { fingerprint: 'from-secret' } })]
    })
    expect(getAccountFingerprint(account)).toBe('from-secret')
  })

  it('prefers decryptedKeys fingerprint from secret', () => {
    const decryptedKeys = [makeKey({ secret: { fingerprint: 'decrypted-fp' } })]
    const account = makeAccount({
      keys: [makeKey({ fingerprint: 'meta-fp' })]
    })
    expect(getAccountFingerprint(account, decryptedKeys)).toBe('decrypted-fp')
  })

  it('falls back to decryptedKey.fingerprint if secret has none', () => {
    const decryptedKeys = [makeKey({ fingerprint: 'dk-fp', secret: {} })]
    const account = makeAccount({ keys: [makeKey()] })
    expect(getAccountFingerprint(account, decryptedKeys)).toBe('dk-fp')
  })

  it('returns empty string when no keys', () => {
    const account = makeAccount({ keys: [] })
    expect(getAccountFingerprint(account)).toBe('')
  })

  it('returns empty string when no fingerprint anywhere', () => {
    const account = makeAccount({
      keys: [makeKey({ secret: {} })]
    })
    expect(getAccountFingerprint(account)).toBe('')
  })
})

describe('checkWalletNeedsSync', () => {
  it('returns true when never synced', () => {
    const account = makeAccount({ lastSyncedAt: undefined })
    expect(checkWalletNeedsSync(account)).toBe(true)
  })

  it('returns false when synced recently', () => {
    const account = makeAccount({ lastSyncedAt: new Date() })
    expect(checkWalletNeedsSync(account)).toBe(false)
  })

  it('returns true when synced more than maxDays ago', () => {
    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 5)
    const account = makeAccount({ lastSyncedAt: staleDate })
    expect(checkWalletNeedsSync(account, 3)).toBe(true)
  })

  it('returns false when synced exactly maxDays ago', () => {
    const exactDate = new Date()
    exactDate.setDate(exactDate.getDate() - 3)
    const account = makeAccount({ lastSyncedAt: exactDate })
    expect(checkWalletNeedsSync(account, 3)).toBe(false)
  })

  it('respects custom maxDays parameter', () => {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 2)
    const account = makeAccount({ lastSyncedAt: oneDayAgo })

    expect(checkWalletNeedsSync(account, 1)).toBe(true)
    expect(checkWalletNeedsSync(account, 3)).toBe(false)
  })
})

describe('updateAccountObjectLabels', () => {
  it('propagates label to utxo by outpoint ref', () => {
    const account = makeAccount({
      labels: {
        'tx-1:0': { label: 'my-utxo', ref: 'tx-1:0', type: 'output' }
      },
      utxos: [
        {
          keychain: 'external',
          label: '',
          txid: 'tx-1',
          value: 50000,
          vout: 0
        }
      ]
    })
    const result = updateAccountObjectLabels(account)
    expect(result.utxos[0].label).toBe('my-utxo')
  })

  it('falls back to address label for utxo', () => {
    const account = makeAccount({
      labels: {
        bc1qaddr: { label: 'savings', ref: 'bc1qaddr', type: 'addr' }
      },
      utxos: [
        {
          addressTo: 'bc1qaddr',
          keychain: 'external',
          label: '',
          txid: 'tx-1',
          value: 50000,
          vout: 0
        }
      ]
    })
    const result = updateAccountObjectLabels(account)
    expect(result.utxos[0].label).toBe('savings')
  })

  it('propagates label to transaction by txid', () => {
    const account = makeAccount({
      labels: {
        'tx-1': { label: 'donation', ref: 'tx-1', type: 'tx' }
      },
      transactions: [
        {
          id: 'tx-1',
          label: '',
          lockTimeEnabled: false,
          prices: {},
          received: 50000,
          sent: 0,
          type: 'receive',
          vin: [],
          vout: []
        }
      ]
    })
    const result = updateAccountObjectLabels(account)
    expect(result.transactions[0].label).toBe('donation')
  })

  it('falls back to output address labels for transaction', () => {
    const account = makeAccount({
      labels: {
        bc1qaddr: { label: 'cold-storage', ref: 'bc1qaddr', type: 'addr' }
      },
      transactions: [
        {
          id: 'tx-1',
          label: '',
          lockTimeEnabled: false,
          prices: {},
          received: 50000,
          sent: 0,
          type: 'receive',
          vin: [],
          vout: [{ address: 'bc1qaddr', script: '', value: 50000 }]
        }
      ]
    })
    const result = updateAccountObjectLabels(account)
    expect(result.transactions[0].label).toBe('cold-storage')
  })

  it('propagates label to address by address ref', () => {
    const account = makeAccount({
      addresses: [
        {
          address: 'bc1qaddr',
          label: '',
          summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
          transactions: [],
          utxos: []
        }
      ],
      labels: {
        bc1qaddr: { label: 'main-addr', ref: 'bc1qaddr', type: 'addr' }
      }
    })
    const result = updateAccountObjectLabels(account)
    expect(result.addresses[0].label).toBe('main-addr')
  })

  it('does not mutate original account', () => {
    const account = makeAccount({
      labels: {
        'tx-1:0': { label: 'labeled', ref: 'tx-1:0', type: 'output' }
      },
      utxos: [
        {
          keychain: 'external',
          label: '',
          txid: 'tx-1',
          value: 50000,
          vout: 0
        }
      ]
    })
    updateAccountObjectLabels(account)
    expect(account.utxos[0].label).toBe('')
  })

  it('handles empty account gracefully', () => {
    const account = makeAccount()
    const result = updateAccountObjectLabels(account)

    expect(result.utxos).toStrictEqual([])
    expect(result.transactions).toStrictEqual([])
    expect(result.addresses).toStrictEqual([])
  })

  it('labels vin and vout from tx label', () => {
    const account = makeAccount({
      labels: {
        'tx-1': { label: 'payment', ref: 'tx-1', type: 'tx' }
      },
      transactions: [
        {
          id: 'tx-1',
          label: '',
          lockTimeEnabled: false,
          prices: {},
          received: 0,
          sent: 50000,
          type: 'send',
          vin: [
            {
              previousOutput: { txid: 'prev-tx', vout: 0 },
              scriptSig: '',
              sequence: 4294967295,
              witness: []
            }
          ],
          vout: [{ address: 'bc1qout', script: '', value: 49750 }]
        }
      ]
    })
    const result = updateAccountObjectLabels(account)

    expect(result.transactions[0].vin[0].label).toBe('payment (input 0)')
    expect(result.transactions[0].vout[0].label).toBe('payment (output 0)')
  })
})
