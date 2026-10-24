import * as nodeCrypto from 'node:crypto'

import * as SecureStore from 'expo-secure-store'
import { __store as secureStore } from 'expo-secure-store'
import QuickCrypto from 'react-native-quick-crypto'

import {
  DURESS_KDF_KEY,
  DURESS_PIN_KEY,
  PIN_KEY,
  PIN_LENGTH_KEY
} from '@/config/auth'
import { useAuthStore } from '@/store/auth'
import { changePin } from '@/utils/pinChange'
import { setSessionPinDigest } from '@/utils/pinSession'

const sk = (key: string) => `1_${key}`

describe('changePin', () => {
  beforeEach(async () => {
    setSessionPinDigest(null)
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockImplementation((key: string) => {
        delete secureStore[key]
        return Promise.resolve()
      })
    jest
      .mocked(QuickCrypto.pbkdf2Sync)
      .mockImplementation(
        (pin: string, salt: string, iterations: number, keylen: number) =>
          nodeCrypto.pbkdf2Sync(pin, salt, iterations, keylen, 'sha256')
      )
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    await useAuthStore.getState().setPin('2468')
    await useAuthStore.getState().setDuressPin('9999')
  })

  it('rejects a new PIN equal to the duress PIN and writes nothing', async () => {
    const pinDigest = secureStore[sk(PIN_KEY)]
    const reEncrypt = jest.fn()

    await expect(changePin('9999', reEncrypt)).resolves.toBe('matchesDuress')

    expect(reEncrypt).not.toHaveBeenCalled()
    expect(secureStore[sk(PIN_KEY)]).toBe(pinDigest)
    await expect(useAuthStore.getState().validatePin('2468')).resolves.toBe(
      true
    )
  })

  it('rejects the duress PIN even while duress is disabled', async () => {
    useAuthStore.getState().setDuressPinEnabled(false)

    await expect(changePin('9999', jest.fn())).resolves.toBe('matchesDuress')
  })

  it('re-encrypts and keeps the duress PIN when the length is unchanged', async () => {
    const oldDigest = secureStore[sk(PIN_KEY)]
    const duressDigest = secureStore[sk(DURESS_PIN_KEY)]
    const reEncrypt = jest.fn().mockResolvedValue(undefined)

    await expect(changePin('1357', reEncrypt)).resolves.toBe('changed')

    expect(reEncrypt).toHaveBeenCalledWith(oldDigest, secureStore[sk(PIN_KEY)])
    expect(secureStore[sk(DURESS_PIN_KEY)]).toBe(duressDigest)
    expect(useAuthStore.getState().duressPinEnabled).toBe(true)
    await expect(useAuthStore.getState().validatePin('1357')).resolves.toBe(
      true
    )
  })

  it('clears the duress PIN when the PIN length changes', async () => {
    await expect(
      changePin('135791', jest.fn().mockResolvedValue(undefined))
    ).resolves.toBe('duressCleared')

    expect(secureStore[sk(PIN_LENGTH_KEY)]).toBe('6')
    expect(secureStore[sk(DURESS_PIN_KEY)]).toBeUndefined()
    expect(secureStore[sk(DURESS_KDF_KEY)]).toBeUndefined()
    expect(useAuthStore.getState().duressPinEnabled).toBe(false)
    await expect(useAuthStore.getState().validatePin('135791')).resolves.toBe(
      true
    )
  })

  it('reports a failed duress cleanup instead of a cleared duress PIN', async () => {
    jest
      .mocked(SecureStore.deleteItemAsync)
      .mockImplementation((key: string) => {
        if (key === sk(DURESS_PIN_KEY)) {
          return Promise.reject(new Error('keystore unavailable'))
        }
        delete secureStore[key]
        return Promise.resolve()
      })

    await expect(
      changePin('135791', jest.fn().mockResolvedValue(undefined))
    ).resolves.toBe('duressClearFailed')

    expect(useAuthStore.getState().duressPinEnabled).toBe(true)
    await expect(useAuthStore.getState().validatePin('135791')).resolves.toBe(
      true
    )
  })

  it('keeps the duress PIN when the stored length is missing', async () => {
    delete secureStore[sk(PIN_LENGTH_KEY)]

    await expect(
      changePin('135791', jest.fn().mockResolvedValue(undefined))
    ).resolves.toBe('changed')

    expect(secureStore[sk(DURESS_PIN_KEY)]).toBeDefined()
    expect(useAuthStore.getState().duressPinEnabled).toBe(true)
  })

  it('keeps the current PIN when re-encryption fails', async () => {
    const pinDigest = secureStore[sk(PIN_KEY)]
    const reEncrypt = jest.fn().mockRejectedValue(new Error('decrypt failed'))

    await expect(changePin('1357', reEncrypt)).resolves.toBe('reEncryptFailed')

    expect(secureStore[sk(PIN_KEY)]).toBe(pinDigest)
    expect(useAuthStore.getState().duressPinEnabled).toBe(true)
  })

  it('sets a first PIN without re-encrypting', async () => {
    setSessionPinDigest(null)
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    const reEncrypt = jest.fn()

    await expect(changePin('2468', reEncrypt)).resolves.toBe('changed')

    expect(reEncrypt).not.toHaveBeenCalled()
    await expect(useAuthStore.getState().validatePin('2468')).resolves.toBe(
      true
    )
  })
})
