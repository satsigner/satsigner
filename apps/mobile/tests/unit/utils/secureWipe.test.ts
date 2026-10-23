import { __store as secureStore } from 'expo-secure-store'

import {
  DURESS_KDF_KEY,
  DURESS_PIN_KEY,
  PIN_KDF_COMMIT_KEY,
  PIN_KDF_KEY,
  PIN_KEY,
  PIN_LENGTH_KEY,
  SALT_KEY,
  SALT_KEY_DURESS
} from '@/config/auth'
import { useAuthStore } from '@/store/auth'
import { getPin } from '@/utils/pin'
import { getSessionPinDigest, setSessionPinDigest } from '@/utils/pinSession'
import { secureWipeAfterMaxPinTries } from '@/utils/secureWipe'

const sk = (key: string) => `1_${key}`

const PIN_BOUND_KEYS = [
  PIN_KEY,
  SALT_KEY,
  PIN_KDF_KEY,
  PIN_KDF_COMMIT_KEY,
  PIN_LENGTH_KEY,
  DURESS_PIN_KEY,
  DURESS_KDF_KEY,
  SALT_KEY_DURESS
]

describe('secureWipeAfterMaxPinTries', () => {
  beforeEach(() => {
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    for (const key of PIN_BOUND_KEYS) {
      secureStore[sk(key)] = `stored-${key}`
    }
    setSessionPinDigest('session-digest')
    useAuthStore.setState({
      duressPinEnabled: true,
      firstTime: false,
      lockTriggered: true,
      pinTries: 5,
      requiresAuth: true
    })
  })

  afterEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState(), true)
  })

  it('leaves no PIN, duress PIN or session key for the next PIN to inherit', async () => {
    await secureWipeAfterMaxPinTries()

    for (const key of PIN_BOUND_KEYS) {
      expect(secureStore[sk(key)]).toBeUndefined()
    }
    expect(getSessionPinDigest()).toBeNull()
    await expect(getPin()).rejects.toThrow('PIN unavailable')
  })

  it('resets the app to a fresh install', async () => {
    await secureWipeAfterMaxPinTries()

    expect(useAuthStore.getState()).toStrictEqual(
      expect.objectContaining({
        duressPinEnabled: false,
        firstTime: true,
        lockTriggered: false,
        pinTries: 0,
        requiresAuth: false
      })
    )
  })
})
