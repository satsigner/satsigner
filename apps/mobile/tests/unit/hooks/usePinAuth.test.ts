import { router } from 'expo-router'

import { DURESS_PIN_KEY, SALT_KEY } from '@/config/auth'
import { verifyPin } from '@/hooks/usePinAuth'
import { getItem } from '@/storage/encrypted'
import { loadAuthenticatedSession } from '@/utils/authenticatedSession'
import { getPin } from '@/utils/pin'
import {
  applyPendingPinKdfCommit,
  derivePinDigest,
  getStoredKdfConfig,
  pinMatchesDuressDigest,
  safeEqualHex
} from '@/utils/pinKdf'
import { finalizePinAuthSuccess } from '@/utils/pinUnlock'
import { secureWipeAllWalletData } from '@/utils/secureWipe'

jest.mock<typeof import('expo-router')>('expo-router', () => ({
  router: { dismissAll: jest.fn(), replace: jest.fn() }
}))
jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  getItem: jest.fn()
}))
jest.mock<typeof import('@/utils/pin')>('@/utils/pin', () => ({
  getPin: jest.fn()
}))
jest.mock<typeof import('@/utils/pinKdf')>('@/utils/pinKdf', () => ({
  applyPendingPinKdfCommit: jest.fn(),
  derivePinDigest: jest.fn(),
  getStoredKdfConfig: jest.fn(),
  pinMatchesDuressDigest: jest.fn(),
  safeEqualHex: jest.fn()
}))
jest.mock<typeof import('@/utils/pinUnlock')>('@/utils/pinUnlock', () => ({
  finalizePinAuthSuccess: jest.fn()
}))
jest.mock<typeof import('@/utils/secureWipe')>('@/utils/secureWipe', () => ({
  secureWipeAllWalletData: jest.fn()
}))
jest.mock<typeof import('@/utils/authenticatedSession')>(
  '@/utils/authenticatedSession',
  () => ({ loadAuthenticatedSession: jest.fn() })
)

const mock = {
  applyPendingPinKdfCommit: jest.mocked(applyPendingPinKdfCommit),
  derivePinDigest: jest.mocked(derivePinDigest),
  finalizePinAuthSuccess: jest.mocked(finalizePinAuthSuccess),
  getItem: jest.mocked(getItem),
  getPin: jest.mocked(getPin),
  getStoredKdfConfig: jest.mocked(getStoredKdfConfig),
  loadAuthenticatedSession: jest.mocked(loadAuthenticatedSession),
  pinMatchesDuressDigest: jest.mocked(pinMatchesDuressDigest),
  safeEqualHex: jest.mocked(safeEqualHex),
  secureWipeAllWalletData: jest.mocked(secureWipeAllWalletData)
}

// getItem is keyed: DURESS_PIN_KEY -> duress digest, SALT_KEY -> salt.
function stubStorage({
  duress,
  salt
}: {
  duress: string | null
  salt: string | null
}) {
  mock.getItem.mockImplementation((key: string) => {
    if (key === DURESS_PIN_KEY) {
      return Promise.resolve(duress)
    }
    if (key === SALT_KEY) {
      return Promise.resolve(salt)
    }
    return Promise.resolve(null)
  })
}

describe('verifyPin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mock.applyPendingPinKdfCommit.mockResolvedValue(undefined)
    mock.getPin.mockResolvedValue('hashed-real-pin')
    mock.getStoredKdfConfig.mockResolvedValue({})
    stubStorage({ duress: 'hashed-duress-pin', salt: 'salt' })
  })

  it('returns error when the KDF commit fails', async () => {
    mock.applyPendingPinKdfCommit.mockRejectedValue(new Error('boom'))
    await expect(verifyPin('1234', false, jest.fn())).resolves.toBe('error')
  })

  it('returns error when the stored PIN or salt is missing', async () => {
    stubStorage({ duress: null, salt: null })
    await expect(verifyPin('1234', false, jest.fn())).resolves.toBe('error')
  })

  it('wipes wallet data and returns duress on a duress PIN', async () => {
    mock.pinMatchesDuressDigest.mockResolvedValue(true)
    const onSuccess = jest.fn()

    const result = await verifyPin('0000', true, onSuccess)

    expect(result).toBe('duress')
    expect(mock.secureWipeAllWalletData).toHaveBeenCalledTimes(1)
    expect(mock.loadAuthenticatedSession).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(mock.derivePinDigest).not.toHaveBeenCalled()
  })

  it('still returns duress when the wipe throws (best-effort)', async () => {
    mock.pinMatchesDuressDigest.mockResolvedValue(true)
    mock.secureWipeAllWalletData.mockRejectedValue(new Error('wipe failed'))

    const result = await verifyPin('0000', true, jest.fn())

    expect(result).toBe('duress')
  })

  it('does not treat the duress PIN as duress when the feature is disabled', async () => {
    mock.pinMatchesDuressDigest.mockResolvedValue(true)
    mock.safeEqualHex.mockReturnValue(false)

    const result = await verifyPin('0000', false, jest.fn())

    expect(result).toBe('fail')
    expect(mock.pinMatchesDuressDigest).not.toHaveBeenCalled()
    expect(mock.secureWipeAllWalletData).not.toHaveBeenCalled()
  })

  it('returns fail on a wrong PIN', async () => {
    mock.pinMatchesDuressDigest.mockResolvedValue(false)
    mock.derivePinDigest.mockResolvedValue('hashed-input')
    mock.safeEqualHex.mockReturnValue(false)

    await expect(verifyPin('9999', true, jest.fn())).resolves.toBe('fail')
    expect(mock.secureWipeAllWalletData).not.toHaveBeenCalled()
  })

  it('finalizes the unlock and returns success on the correct PIN', async () => {
    mock.pinMatchesDuressDigest.mockResolvedValue(false)
    mock.derivePinDigest.mockResolvedValue('hashed-real-pin')
    mock.safeEqualHex.mockReturnValue(true)
    mock.finalizePinAuthSuccess.mockResolvedValue(undefined)
    const onSuccess = jest.fn()

    const result = await verifyPin('1234', true, onSuccess)

    expect(result).toBe('success')
    expect(mock.finalizePinAuthSuccess).toHaveBeenCalledWith(
      '1234',
      'salt',
      'hashed-real-pin',
      onSuccess
    )
  })

  it('returns error when finalizing the unlock throws', async () => {
    mock.pinMatchesDuressDigest.mockResolvedValue(false)
    mock.derivePinDigest.mockResolvedValue('hashed-real-pin')
    mock.safeEqualHex.mockReturnValue(true)
    mock.finalizePinAuthSuccess.mockRejectedValue(new Error('fail'))

    await expect(verifyPin('1234', true, jest.fn())).resolves.toBe('error')
  })
})
