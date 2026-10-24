import * as SecureStore from 'expo-secure-store'
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
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockImplementation((key: string) => {
        delete secureStore[key]
        return Promise.resolve()
      })
    useAuthStore.setState(useAuthStore.getInitialState(), true)
  })

  it('leaves no PIN, duress PIN or session key for the next PIN to inherit', async () => {
    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(true)

    for (const key of PIN_BOUND_KEYS) {
      expect(secureStore[sk(key)]).toBeUndefined()
    }
    expect(getSessionPinDigest()).toBeNull()
    await expect(getPin()).rejects.toThrow('PIN unavailable')
  })

  it('stays locked when the PIN material cannot be deleted', async () => {
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockImplementation((key: string) => {
        if (key === sk(PIN_KEY)) {
          return Promise.reject(new Error('keystore unavailable'))
        }
        delete secureStore[key]
        return Promise.resolve()
      })

    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(false)

    expect(secureStore[sk(PIN_KEY)]).toBe(`stored-${PIN_KEY}`)
    expect(getSessionPinDigest()).toBe('session-digest')
    expect(useAuthStore.getState()).toStrictEqual(
      expect.objectContaining({
        firstTime: false,
        lockTriggered: true,
        requiresAuth: true
      })
    )
  })

  it('resets the app to a fresh install', async () => {
    await expect(secureWipeAfterMaxPinTries()).resolves.toBe(true)

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
