import { decryptAccountKeysOrFallback } from '@/hooks/useDecryptedKeys'
import type { Account, Key } from '@/types/models/Account'

jest.mock<Partial<typeof import('@/storage/encrypted')>>(
  '@/storage/encrypted',
  () => ({
    getKeySecret: jest.fn()
  })
)

jest.mock<Partial<typeof import('@/utils/crypto')>>('@/utils/crypto', () => ({
  aesDecrypt: jest.fn()
}))

jest.mock<Partial<typeof import('@/utils/pin')>>('@/utils/pin', () => ({
  getPin: jest.fn()
}))

const { getKeySecret } = jest.requireMock('@/storage/encrypted')
const { aesDecrypt } = jest.requireMock('@/utils/crypto')
const { getPin } = jest.requireMock('@/utils/pin')

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

describe('decryptAccountKeysOrFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps a key unchanged when its secret fails to decrypt', async () => {
    getPin.mockResolvedValue('1234')
    getKeySecret.mockResolvedValue({ iv: 'iv-1', secret: 'enc' })
    aesDecrypt
      .mockResolvedValueOnce(JSON.stringify({ mnemonic: 'word1 word2' }))
      .mockRejectedValueOnce(new Error('bad key'))
    const encryptedKey = makeKey({ index: 1, secret: 'still-encrypted' })
    const account = makeAccount({ keys: [makeKey(), encryptedKey] })

    const keys = await decryptAccountKeysOrFallback(account)

    expect(keys[0].secret).toStrictEqual({ mnemonic: 'word1 word2' })
    expect(keys[1]).toBe(encryptedKey)
  })
})
