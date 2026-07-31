import type { Account, Key } from '@/types/models/Account'
import {
  decryptAccountKeySecretUsingPin,
  decryptKeySecretAt,
  decryptKeySecretUsingPin,
  getAccountWithDecryptedKeys
} from '@/utils/decryption'

jest.mock<Partial<typeof import('@/storage/encrypted')>>(
  '@/storage/encrypted',
  () => ({
    getKeySecret: jest.fn()
  })
)

jest.mock<Partial<typeof import('@/utils/crypto')>>('@/utils/crypto', () => ({
  aesDecrypt: jest.fn(),
  getPin: jest.fn()
}))

const { getKeySecret } = jest.requireMock('@/storage/encrypted')

const { aesDecrypt, getPin } = jest.requireMock('@/utils/crypto')

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
    ).rejects.toThrow('Invalid JSON object')
  })

  it('strips unrecognized keys from the parsed secret', async () => {
    getKeySecret.mockResolvedValue({ iv: 'iv-1', secret: 'enc' })
    aesDecrypt.mockResolvedValue(JSON.stringify({ evil: true, mnemonic: 'w' }))
    const secret = await decryptAccountKeySecretUsingPin('acc-1', 0, '1234')
    expect(secret).toStrictEqual({ mnemonic: 'w' })
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
      'Invalid JSON object'
    )
  })

  it('strips unrecognized keys from the parsed secret', async () => {
    aesDecrypt.mockResolvedValue(JSON.stringify({ evil: true, mnemonic: 'w' }))
    const key = makeKey({ iv: 'iv-1', secret: 'encrypted-string' })
    const secret = await decryptKeySecretUsingPin(key, '1234')
    expect(secret).toStrictEqual({ mnemonic: 'w' })
  })

  it('falls back to secure storage when the secret is empty and accountId is set', async () => {
    getKeySecret.mockResolvedValue({ iv: 'stored-iv', secret: 'stored-enc' })
    aesDecrypt.mockResolvedValue(JSON.stringify({ mnemonic: 'word1 word2' }))
    const key = makeKey({ accountId: 'acc-1', index: 2 })
    const secret = await decryptKeySecretUsingPin(key, '1234')
    expect(getKeySecret).toHaveBeenCalledWith('acc-1', 2)
    expect(aesDecrypt).toHaveBeenCalledWith('stored-enc', '1234', 'stored-iv')
    expect(secret).toStrictEqual({ mnemonic: 'word1 word2' })
  })

  it('throws when the secret is empty and there is no accountId', async () => {
    const key = makeKey()
    await expect(decryptKeySecretUsingPin(key, '1234')).rejects.toThrow(
      'Key secret not available'
    )
    expect(aesDecrypt).not.toHaveBeenCalled()
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

describe('getAccountWithDecryptedKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the account with each key secret decrypted', async () => {
    getPin.mockResolvedValue('1234')
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
    const result = await getAccountWithDecryptedKeys(account)
    expect(result.keys[0].secret).toStrictEqual({
      mnemonic: 'mnemonic-for-enc-0'
    })
    expect(result.keys[1].secret).toStrictEqual({
      mnemonic: 'mnemonic-for-enc-1'
    })
  })

  it('propagates decryption errors with account context', async () => {
    getPin.mockResolvedValue('1234')
    getKeySecret.mockResolvedValue(null)
    const account = makeAccount({ keys: [makeKey()] })
    await expect(getAccountWithDecryptedKeys(account)).rejects.toThrow(
      /account Test/
    )
  })
})
