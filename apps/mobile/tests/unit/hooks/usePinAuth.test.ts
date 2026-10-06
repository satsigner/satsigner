import { router } from 'expo-router'
import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { toast } from 'sonner-native'

import { DURESS_PIN_KEY, PIN_SIZE, SALT_KEY } from '@/config/auth'
import { usePinAuth, verifyPin } from '@/hooks/usePinAuth'
import { getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { loadAuthenticatedSession } from '@/utils/authenticatedSession'
import { emptyPin, getPin } from '@/utils/pin'
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
  ...jest.requireActual<typeof import('@/utils/pin')>('@/utils/pin'),
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

  it('returns error when the stored salt is missing', async () => {
    stubStorage({ duress: null, salt: null })
    await expect(verifyPin('1234', false, jest.fn())).resolves.toBe('error')
  })

  it('returns error when the stored PIN is missing', async () => {
    mock.getPin.mockRejectedValue(new Error('PIN unavailable'))
    await expect(verifyPin('1234', false, jest.fn())).resolves.toBe('error')
    expect(mock.derivePinDigest).not.toHaveBeenCalled()
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

type PinAuth = ReturnType<typeof usePinAuth>

// Renderers mounted by renderPinAuth, unmounted after each test.
const mounted: ReactTestRenderer[] = []

// Renders usePinAuth in a throwaway component and exposes its latest return.
async function renderPinAuth(props: Parameters<typeof usePinAuth>[0]) {
  const hook: { current: PinAuth | null } = { current: null }
  function Harness() {
    hook.current = usePinAuth(props)
    return null
  }
  await act(async () => {
    mounted.push(create(createElement(Harness)))
  })
  return hook
}

async function enterPin(hook: { current: PinAuth | null }, pin: string) {
  await act(async () => {
    await hook.current?.handleFillEnded(pin)
  })
}

describe('usePinAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mock.applyPendingPinKdfCommit.mockResolvedValue(undefined)
    mock.getPin.mockResolvedValue('hashed-real-pin')
    mock.getStoredKdfConfig.mockResolvedValue({})
    mock.pinMatchesDuressDigest.mockResolvedValue(false)
    mock.derivePinDigest.mockResolvedValue('hashed-input')
    mock.safeEqualHex.mockReturnValue(false)
    stubStorage({ duress: 'hashed-duress-pin', salt: 'salt' })
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mounted.splice(0)) {
        renderer.unmount()
      }
    })
    useAuthStore.setState(useAuthStore.getInitialState(), true)
  })

  it('loads an empty PIN of the default length', async () => {
    const hook = await renderPinAuth({ onSuccess: jest.fn() })
    expect(hook.current?.pin).toStrictEqual(emptyPin(PIN_SIZE))
  })

  it('counts wrong PINs and calls onTriesOver once maxTries is reached', async () => {
    const onFail = jest.fn()
    const onTriesOver = jest.fn()
    const hook = await renderPinAuth({
      maxTries: 2,
      onFail,
      onSuccess: jest.fn(),
      onTriesOver
    })

    await enterPin(hook, '9999')
    expect(onFail).toHaveBeenCalledTimes(1)
    expect(onTriesOver).not.toHaveBeenCalled()
    expect(hook.current?.verifying).toBe(false)
    expect(hook.current?.pin).toStrictEqual(emptyPin(PIN_SIZE))

    await enterPin(hook, '9999')
    expect(onFail).toHaveBeenCalledTimes(2)
    expect(onTriesOver).toHaveBeenCalledTimes(1)
  })

  it('never calls onTriesOver without maxTries', async () => {
    const onTriesOver = jest.fn()
    const hook = await renderPinAuth({ onSuccess: jest.fn(), onTriesOver })

    await enterPin(hook, '9999')
    await enterPin(hook, '9999')

    expect(onTriesOver).not.toHaveBeenCalled()
  })

  it('shows an error toast and does not count a try on error', async () => {
    mock.applyPendingPinKdfCommit.mockRejectedValue(new Error('boom'))
    const onFail = jest.fn()
    const onTriesOver = jest.fn()
    const hook = await renderPinAuth({
      maxTries: 1,
      onFail,
      onSuccess: jest.fn(),
      onTriesOver
    })

    await enterPin(hook, '1234')

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(onFail).not.toHaveBeenCalled()
    expect(onTriesOver).not.toHaveBeenCalled()
    expect(hook.current?.verifying).toBe(false)
  })

  it('unlocks and navigates home on a duress PIN', async () => {
    useAuthStore.setState({ duressPinEnabled: true, lockTriggered: true })
    mock.pinMatchesDuressDigest.mockResolvedValue(true)
    const hook = await renderPinAuth({ onSuccess: jest.fn() })

    await enterPin(hook, '0000')

    expect(mock.secureWipeAllWalletData).toHaveBeenCalledTimes(1)
    expect(mock.loadAuthenticatedSession).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().justUnlocked).toBe(true)
    expect(useAuthStore.getState().lockTriggered).toBe(false)
    expect(router.dismissAll).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith('/')
  })
})
