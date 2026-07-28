import type { Account, Key } from '@/types/models/Account'
import {
  decryptAccountKeySecretUsingPin,
  decryptKeySecretAt,
  decryptKeySecretUsingPin,
  getBitcoinWithDecryptedKeys,
  getPin
} from '@/utils/decryption'

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  getItem: jest.fn(),
  getKeySecret: jest.fn()
}))

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  aesDecrypt: jest.fn()
}))

const { getItem, getKeySecret } = jest.requireMock('@/storage/encrypted') as {
  getItem: jest.Mock
  getKeySecret: jest.Mock
}
const { aesDecrypt } = jest.requireMock('@/utils/crypto') as {
  aesDecrypt: jest.Mock
}

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

describe('getPin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the stored pin', async () => {
    getItem.mockResolvedValue('1234')

    await expect(getPin()).resolves.toBe('1234')
  })

  it('throws when no pin is stored', async () => {
    getItem.mockResolvedValue(null)

    await expect(getPin()).rejects.toThrow(
      'Failed to obtain PIN for decryption'
    )
  })
})

describe('decryptAccountKeySecretUsingPin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the decrypted and parsed secret', async () => {
    getKeySecret.mockResolvedValue({ iv: 'iv-1', secret: 'enc' })
    aesDecrypt.mockResolvedValue(JSON.stringify({ mnemonic: 'word1 word2' }))

    const secret = await decryptAccountKeySecretUsingPin('acc-1', 0, '1234')

    expect(getKeySecret).toHaveBeenCalledWith('acc-1', 0)
    expect(aesDecrypt).toHaveBeenCalledWith('enc', '1234', 'iv-1')
    expect(secret).toStrictEqual({ mnemonic: 'word1 word2' })
  })

  it('throws when no secret is stored for the key', async () => {
    getKeySecret.mockResolvedValue(null)

    await expect(
      decryptAccountKeySecretUsingPin('acc-1', 2, '1234')
    ).rejects.toThrow('Key secret not found in secure storage (key #2)')
  })

  it('throws when AES decryption fails', async () => {
    getKeySecret.mockResolvedValue({ iv: 'iv-1', secret: 'enc' })
    aesDecrypt.mockRejectedValue(new Error('bad key'))

    await expect(
      decryptAccountKeySecretUsingPin('acc-1', 0, 'wrong-pin')
    ).rejects.toThrow('AES decryption failed')
  })

  it('throws when the decrypted payload is not valid JSON', async () => {
    getKeySecret.mockResolvedValue({ iv: 'iv-1', secret: 'enc' })
    aesDecrypt.mockResolvedValue('not-json')

    await expect(
      decryptAccountKeySecretUsingPin('acc-1', 0, '1234')
    ).rejects.toThrow('Failed to parse decrypted key secret')
  })

  it('throws when the parsed secret has unexpected keys', async () => {
    getKeySecret.mockResolvedValue({ iv: 'iv-1', secret: 'enc' })
    aesDecrypt.mockResolvedValue(JSON.stringify({ evil: true, mnemonic: 'w' }))

    await expect(
      decryptAccountKeySecretUsingPin('acc-1', 0, '1234')
    ).rejects.toThrow('Invalid serialized secret')
  })
})

describe('decryptKeySecretUsingPin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the secret unchanged when already an object', async () => {
    const key = makeKey({ secret: { mnemonic: 'already decrypted' } })

    const secret = await decryptKeySecretUsingPin(key, '1234')

    expect(secret).toStrictEqual({ mnemonic: 'already decrypted' })
    expect(aesDecrypt).not.toHaveBeenCalled()
  })

  it('decrypts and parses an encrypted string secret', async () => {
    aesDecrypt.mockResolvedValue(JSON.stringify({ mnemonic: 'word1 word2' }))
    const key = makeKey({ iv: 'iv-1', secret: 'encrypted-string' })

    const secret = await decryptKeySecretUsingPin(key, '1234')

    expect(aesDecrypt).toHaveBeenCalledWith('encrypted-string', '1234', 'iv-1')
    expect(secret).toStrictEqual({ mnemonic: 'word1 word2' })
  })

  it('throws when AES decryption fails', async () => {
    aesDecrypt.mockRejectedValue(new Error('bad key'))
    const key = makeKey({ iv: 'iv-1', secret: 'encrypted-string' })

    await expect(decryptKeySecretUsingPin(key, 'wrong-pin')).rejects.toThrow(
      'AES decryption failed'
    )
  })

  it('throws when the decrypted payload is not valid JSON', async () => {
    aesDecrypt.mockResolvedValue('not-json')
    const key = makeKey({ iv: 'iv-1', secret: 'encrypted-string' })

    await expect(decryptKeySecretUsingPin(key, '1234')).rejects.toThrow(
      'Failed to parse decrypted key secret'
    )
  })

  it('throws when the parsed secret has unexpected keys', async () => {
    aesDecrypt.mockResolvedValue(JSON.stringify({ evil: true }))
    const key = makeKey({ iv: 'iv-1', secret: 'encrypted-string' })

    await expect(decryptKeySecretUsingPin(key, '1234')).rejects.toThrow(
      'Invalid serialized secret'
    )
  })
})

describe('decryptKeySecretAt', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the decrypted secret on success', async () => {
    getKeySecret.mockResolvedValue({ iv: 'iv-1', secret: 'enc' })
    aesDecrypt.mockResolvedValue(JSON.stringify({ mnemonic: 'w' }))

    const secret = await decryptKeySecretAt('acc-1', 0, '1234')

    expect(secret).toStrictEqual({ mnemonic: 'w' })
  })

  it('wraps the underlying error with key index context', async () => {
    getKeySecret.mockResolvedValue(null)

    await expect(decryptKeySecretAt('acc-1', 3, '1234')).rejects.toThrow(
      'Key secret not found in secure storage (key #3) [key #3]'
    )
  })
})

describe('getBitcoinWithDecryptedKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the account with each key secret decrypted', async () => {
    getItem.mockResolvedValue('1234')
    getKeySecret.mockImplementation((_accountId: string, keyIndex: number) => ({
      iv: `iv-${keyIndex}`,
      secret: `enc-${keyIndex}`
    }))
    aesDecrypt.mockImplementation((secret: string) =>
      JSON.stringify({ mnemonic: `mnemonic-for-${secret}` })
    )

    const account = makeAccount({
      keys: [makeKey({ index: 0 }), makeKey({ index: 1 })]
    })

    const result = await getBitcoinWithDecryptedKeys(account)

    expect(result.keys[0].secret).toStrictEqual({
      mnemonic: 'mnemonic-for-enc-0'
    })
    expect(result.keys[1].secret).toStrictEqual({
      mnemonic: 'mnemonic-for-enc-1'
    })
  })

  it('propagates decryption errors with account context', async () => {
    getItem.mockResolvedValue('1234')
    getKeySecret.mockResolvedValue(null)

    const account = makeAccount({ keys: [makeKey()] })

    await expect(getBitcoinWithDecryptedKeys(account)).rejects.toThrow(
      /account Test/
    )
  })
})
