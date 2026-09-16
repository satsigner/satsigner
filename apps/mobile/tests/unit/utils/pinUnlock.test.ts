import { getKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { recoverWorkingPinDigest } from '@/utils/pinKdf'
import { setSessionPinDigest } from '@/utils/pinSession'
import {
  finalizePinAuthSuccess,
  getFirstEncryptedKeyProbe
} from '@/utils/pinUnlock'

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  getKeySecret: jest.fn()
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: jest.fn()
  }
}))

jest.mock<typeof import('@/utils/pinKdf')>('@/utils/pinKdf', () => ({
  recoverWorkingPinDigest: jest.fn()
}))

jest.mock<typeof import('@/utils/pinSession')>('@/utils/pinSession', () => ({
  setSessionPinDigest: jest.fn()
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

describe('finalizePinAuthSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useAccountsStore.getState).mockReturnValue({ accounts: [] })
    jest.mocked(recoverWorkingPinDigest).mockResolvedValue('digest')
  })

  it('rejects when onSuccess rejects', async () => {
    const onSuccess = jest.fn().mockRejectedValue(new Error('unlock failed'))

    await expect(
      finalizePinAuthSuccess('1234', 'salt', 'stored', onSuccess)
    ).rejects.toThrow('unlock failed')
    expect(recoverWorkingPinDigest).toHaveBeenCalledWith(
      '1234',
      'salt',
      'stored',
      null
    )
    expect(setSessionPinDigest).toHaveBeenCalledWith('digest')
  })
})
