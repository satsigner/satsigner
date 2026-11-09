import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { setDuressPinSafely } from '@/utils/duressPin'
import { getPin } from '@/utils/pin'
import { derivePinDigest, safeEqualHex } from '@/utils/pinKdf'

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  ...jest.requireActual<typeof import('@/storage/encrypted')>(
    '@/storage/encrypted'
  ),
  getItem: jest.fn()
}))
jest.mock<typeof import('@/utils/pin')>('@/utils/pin', () => ({
  ...jest.requireActual<typeof import('@/utils/pin')>('@/utils/pin'),
  getPin: jest.fn()
}))
jest.mock<typeof import('@/utils/pinKdf')>('@/utils/pinKdf', () => ({
  ...jest.requireActual<typeof import('@/utils/pinKdf')>('@/utils/pinKdf'),
  derivePinDigest: jest.fn(),
  getStoredKdfConfig: jest.fn(),
  safeEqualHex: jest.fn()
}))

describe('setDuressPinSafely', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(getItem).mockResolvedValue('salt')
    jest.mocked(getPin).mockResolvedValue('main-digest')
    jest.mocked(derivePinDigest).mockResolvedValue('candidate')
    jest.mocked(safeEqualHex).mockReturnValue(false)
  })

  it('refuses a duress PIN equal to the main PIN', async () => {
    jest.mocked(safeEqualHex).mockReturnValue(true)

    await expect(setDuressPinSafely('1234')).resolves.toBe('matchesMainPin')
  })

  it('needs a main PIN first', async () => {
    jest.mocked(getItem).mockResolvedValue(null)

    await expect(setDuressPinSafely('1234')).resolves.toBe('mainPinMissing')
  })

  it('reports a failure instead of throwing when storing fails', async () => {
    jest
      .spyOn(useAuthStore.getState(), 'setDuressPin')
      .mockRejectedValueOnce(new Error('keychain locked'))

    await expect(setDuressPinSafely('5678')).resolves.toBe('failed')
  })
})
