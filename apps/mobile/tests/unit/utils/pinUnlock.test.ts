import { getKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { getFirstEncryptedKeyProbe } from '@/utils/pinUnlock'

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  getKeySecret: jest.fn()
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: jest.fn()
  }
}))

describe('getFirstEncryptedKeyProbe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the first stored key secret', async () => {
    jest.mocked(useAccountsStore.getState).mockReturnValue({
      accounts: [{ id: 'acc-1', keys: [{}, {}] }]
    })
    jest
      .mocked(getKeySecret)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ iv: 'iv', secret: 'ciphertext' })

    await expect(getFirstEncryptedKeyProbe()).resolves.toStrictEqual({
      iv: 'iv',
      secret: 'ciphertext'
    })
  })

  it('returns null when no encrypted keys exist', async () => {
    jest.mocked(useAccountsStore.getState).mockReturnValue({ accounts: [] })
    await expect(getFirstEncryptedKeyProbe()).resolves.toBeNull()
  })
})
