import * as nodeCrypto from 'node:crypto'

import { __store as secureStore } from 'expo-secure-store'
import QuickCrypto from 'react-native-quick-crypto'

import {
  DURESS_PIN_KEY,
  PIN_KDF_KEY,
  PIN_KEY,
  PIN_LENGTH_KEY,
  SALT_KEY
} from '@/config/auth'
import { useAuthStore } from '@/store/auth'
import { parseKdf } from '@/utils/pinKdf'

const sk = (key: string) => `1_${key}`

function legacyDigest(pin: string, salt: string): string {
  return nodeCrypto.pbkdf2Sync(pin, salt, 10_000, 32, 'sha256').toString('hex')
}

describe('auth store PIN handling', () => {
  beforeEach(() => {
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    jest
      .mocked(QuickCrypto.pbkdf2Sync)
      .mockImplementation(
        (pin: string, salt: string, iterations: number, keylen: number) =>
          nodeCrypto.pbkdf2Sync(pin, salt, iterations, keylen, 'sha256')
      )
  })

  it('setPin stores the digest, its KDF config, and the PIN length', async () => {
    await useAuthStore.getState().setPin('246810')

    expect(secureStore[sk(PIN_KEY)]).toMatch(/^[0-9a-f]{64}$/)
    expect(parseKdf(secureStore[sk(PIN_KDF_KEY)])).not.toBeNull()
    expect(secureStore[sk(PIN_LENGTH_KEY)]).toBe('6')
    expect(secureStore[sk(SALT_KEY)]).toMatch(/^[0-9a-f]{32}$/)
  })

  it('validatePin accepts the PIN just set and rejects others', async () => {
    await useAuthStore.getState().setPin('246810')

    await expect(useAuthStore.getState().validatePin('246810')).resolves.toBe(
      true
    )
    await expect(useAuthStore.getState().validatePin('246811')).resolves.toBe(
      false
    )
    await expect(useAuthStore.getState().validatePin('2468')).resolves.toBe(
      false
    )
  })

  it('validatePin verifies legacy digests written before KDF tracking', async () => {
    const salt = '00112233445566778899aabbccddeeff'
    secureStore[sk(SALT_KEY)] = salt
    secureStore[sk(PIN_KEY)] = legacyDigest('1234', salt)
    // no PIN_KDF_KEY: pre-upgrade install

    await expect(useAuthStore.getState().validatePin('1234')).resolves.toBe(
      true
    )
    await expect(useAuthStore.getState().validatePin('0000')).resolves.toBe(
      false
    )
  })

  it('setDuressPin does not clobber the main PIN salt', async () => {
    await useAuthStore.getState().setPin('1234')
    const saltAfterMainPin = secureStore[sk(SALT_KEY)]

    await useAuthStore.getState().setDuressPin('4321')

    expect(secureStore[sk(SALT_KEY)]).toBe(saltAfterMainPin)
    await expect(useAuthStore.getState().validatePin('1234')).resolves.toBe(
      true
    )
  })

  it('setPin reuses the salt so a later PIN change does not invalidate duress', async () => {
    await useAuthStore.getState().setPin('1234')
    const saltAfterMainPin = secureStore[sk(SALT_KEY)]
    await useAuthStore.getState().setDuressPin('4321')
    const duressDigest = secureStore[sk(DURESS_PIN_KEY)]
    expect(useAuthStore.getState().duressPinEnabled).toBe(true)

    await useAuthStore.getState().setPin('5678')

    expect(secureStore[sk(SALT_KEY)]).toBe(saltAfterMainPin)
    expect(secureStore[sk(DURESS_PIN_KEY)]).toBe(duressDigest)
    await expect(useAuthStore.getState().validatePin('5678')).resolves.toBe(
      true
    )
    await expect(useAuthStore.getState().validatePin('1234')).resolves.toBe(
      false
    )
  })
})
