import { ZodError } from 'zod'

import { getKeySecret, storeKeySecret } from '@/storage/encrypted'
import type { Key } from '@/types/models/Account'
import { dropSeedFromKey } from '@/utils/account'
import { aesDecrypt, aesEncrypt } from '@/utils/crypto'
import { getPin } from '@/utils/pin'

jest.mock<Partial<typeof import('@/storage/encrypted')>>(
  '@/storage/encrypted',
  () => ({
    getKeySecret: jest.fn(),
    storeKeySecret: jest.fn()
  })
)

jest.mock<Partial<typeof import('@/utils/crypto')>>('@/utils/crypto', () => ({
  aesDecrypt: jest.fn(),
  aesEncrypt: jest.fn()
}))

jest.mock<Partial<typeof import('@/utils/pin')>>('@/utils/pin', () => ({
  getPin: jest.fn()
}))

const key: Key = {
  creationType: 'importMnemonic',
  index: 0,
  iv: 'iv',
  secret: 'encrypted-secret'
}

describe('dropSeedFromKey', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getPin).mockResolvedValue('1234')
    jest
      .mocked(getKeySecret)
      .mockResolvedValue({ iv: 'iv', secret: 'encrypted-secret' })
    jest
      .mocked(aesEncrypt)
      .mockImplementation((plaintext) =>
        Promise.resolve(`encrypted:${plaintext}`)
      )
  })

  it('re-stores the secret without mnemonic and passphrase', async () => {
    jest.mocked(aesDecrypt).mockResolvedValue(
      JSON.stringify({
        extendedPublicKey: 'xpub123',
        fingerprint: 'abcdef12',
        mnemonic: 'abandon abandon about',
        passphrase: 'secret'
      })
    )

    await expect(dropSeedFromKey('acc-1', key, 0)).resolves.toStrictEqual(key)

    const [[accountId, keyIndex, secret, iv]] =
      jest.mocked(storeKeySecret).mock.calls
    expect(accountId).toBe('acc-1')
    expect(keyIndex).toBe(0)
    expect(iv).toBe('iv')
    expect(JSON.parse(secret.replace('encrypted:', ''))).toStrictEqual({
      extendedPublicKey: 'xpub123',
      fingerprint: 'abcdef12'
    })
  })

  it('rejects a decrypted payload that is not a secret and keeps storage untouched', async () => {
    jest.mocked(aesDecrypt).mockResolvedValue(JSON.stringify('not a secret'))

    await expect(dropSeedFromKey('acc-1', key, 0)).rejects.toThrow(ZodError)
    expect(storeKeySecret).not.toHaveBeenCalled()
  })

  it('rejects a secret with mistyped fields and keeps storage untouched', async () => {
    jest
      .mocked(aesDecrypt)
      .mockResolvedValue(JSON.stringify({ fingerprint: 1234 }))

    await expect(dropSeedFromKey('acc-1', key, 0)).rejects.toThrow(ZodError)
    expect(storeKeySecret).not.toHaveBeenCalled()
  })
})
