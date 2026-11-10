// The shared quick-crypto mock stubs cipher/decipher with fixed buffers.
// Backups must really decrypt, so overlay node:crypto ciphers on it.
jest.mock<typeof import('react-native-quick-crypto')>(
  'react-native-quick-crypto',
  () => {
    const nodeCrypto = jest.requireActual('node:crypto')
    const shared = jest.requireActual(
      '../../../__mocks__/react-native-quick-crypto'
    ).default
    return {
      __esModule: true,
      default: {
        ...shared,
        createCipheriv: (alg: string, key: Uint8Array, iv: Uint8Array) =>
          nodeCrypto.createCipheriv(alg, key, iv),
        createDecipheriv: (alg: string, key: Uint8Array, iv: Uint8Array) =>
          nodeCrypto.createDecipheriv(alg, key, iv)
      }
    }
  }
)

import QuickCrypto from 'react-native-quick-crypto'

import { decryptBackup, encryptBackup } from '@/utils/backupEncryption'
import {
  aesEncrypt,
  generateSalt,
  pbkdf2Encrypt,
  randomIv
} from '@/utils/crypto'

const PASSPHRASE = 'correct horse battery staple'
const WRONG_PASSPHRASE = 'incorrect horse battery staple'
const PAYLOAD = JSON.stringify({ accounts: [{ name: 'Savings' }], v: 1 })

// Written independently with node:crypto (PBKDF2-SHA256 10k + AES-256-CBC),
// the format every release up to v2 exported. Never regenerate these.
const V1_FIXTURE =
  '{"cipher":"iwI5UQlEcUUrtSvHOBh7TFUtlfKFPb0uhtxWcrbt42g=","iv":"8f3e2a1b0c9d4e5f6a7b8c9d0e1f2a3b","salt":"5a0d2c7e9b14f3a86c21e0d47b9f5a13","v":1}'
const V1_HEX_CIPHER_FIXTURE =
  '{"cipher":"8b023951094471452bb52bc738187b4c552d95f2853dbd2e86dc5672b6ede368","iv":"8f3e2a1b0c9d4e5f6a7b8c9d0e1f2a3b","salt":"5a0d2c7e9b14f3a86c21e0d47b9f5a13","v":1}'
const V1_FIXTURE_PLAINTEXT = '{"accounts":[],"fixture":"v1"}'

// PBKDF2-SHA256 600k + AES-256-GCM, written with node:crypto.
const V2_PBKDF2_FIXTURE =
  '{"cipher":"ZZqmcPKIc5NnZvO/MtqF7cBbFB3z1QNXjfkzO/Mt","iv":"a1b2c3d4e5f60718293a4b5c","kdf":"pbkdf2:i=600000","salt":"0f1e2d3c4b5a69788796a5b4c3d2e1f0","tag":"51a531dc392fc2c4711dac82ca2eba6c","v":2}'
const V2_FIXTURE_PLAINTEXT = '{"accounts":[],"fixture":"v2"}'

async function encryptWithV1Format(payload: string, passphrase: string) {
  const salt = await generateSalt()
  const key = await pbkdf2Encrypt(passphrase, salt)
  const iv = randomIv()
  const cipher = await aesEncrypt(payload, key, iv)
  return JSON.stringify({ cipher, iv, salt, v: 1 })
}

function flipFirstChar(value: string, alphabet: string) {
  const replacement = value[0] === alphabet[0] ? alphabet[1] : alphabet[0]
  return `${replacement}${value.slice(1)}`
}

function tamper(backup: string, field: 'cipher' | 'iv' | 'tag') {
  const parsed = JSON.parse(backup)
  const alphabet = field === 'cipher' ? 'AB' : '01'
  return JSON.stringify({
    ...parsed,
    [field]: flipFirstChar(parsed[field], alphabet)
  })
}

function failArgon2() {
  jest.mocked(QuickCrypto.argon2).mockImplementationOnce(
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- native callback API
    (_algorithm, _params, callback) => {
      callback(new Error('argon2 unavailable'), Buffer.alloc(0))
    }
  )
}

describe('backup encryption', () => {
  describe('v2 export', () => {
    it('round-trips with argon2id and AES-256-GCM', async () => {
      const backup = await encryptBackup(PAYLOAD, PASSPHRASE)
      const parsed = JSON.parse(backup)

      expect(parsed).toMatchObject({
        kdf: 'argon2id:m=65536,t=3,p=1',
        v: 2
      })
      expect(parsed.tag).toMatch(/^[0-9a-f]{32}$/)
      expect(parsed.iv).toMatch(/^[0-9a-f]{24}$/)
      await expect(decryptBackup(backup, PASSPHRASE)).resolves.toStrictEqual({
        plaintext: PAYLOAD,
        status: 'decrypted'
      })
    })

    it('falls back to scrypt when argon2id fails and still round-trips', async () => {
      failArgon2()

      const backup = await encryptBackup(PAYLOAD, PASSPHRASE)

      expect(JSON.parse(backup).kdf).toBe('scrypt:N=32768,r=8,p=1')
      await expect(decryptBackup(backup, PASSPHRASE)).resolves.toStrictEqual({
        plaintext: PAYLOAD,
        status: 'decrypted'
      })
    })

    it('uses a fresh salt and iv on every export', async () => {
      const first = JSON.parse(await encryptBackup(PAYLOAD, PASSPHRASE))
      const second = JSON.parse(await encryptBackup(PAYLOAD, PASSPHRASE))

      expect(first.salt).not.toBe(second.salt)
      expect(first.iv).not.toBe(second.iv)
    })

    it('decrypts the static pbkdf2 v2 fixture', async () => {
      await expect(
        decryptBackup(V2_PBKDF2_FIXTURE, PASSPHRASE)
      ).resolves.toStrictEqual({
        plaintext: V2_FIXTURE_PLAINTEXT,
        status: 'decrypted'
      })
    })

    it('rejects a wrong passphrase', async () => {
      const backup = await encryptBackup(PAYLOAD, PASSPHRASE)

      await expect(
        decryptBackup(backup, WRONG_PASSPHRASE)
      ).resolves.toStrictEqual({ status: 'wrongPassphrase' })
    })

    it.each(['cipher', 'iv', 'tag'] as const)(
      'rejects a backup with a tampered %s',
      async (field) => {
        const backup = await encryptBackup(PAYLOAD, PASSPHRASE)

        await expect(
          decryptBackup(tamper(backup, field), PASSPHRASE)
        ).resolves.toStrictEqual({ status: 'wrongPassphrase' })
      }
    )

    it('rejects a truncated auth tag', async () => {
      const parsed = JSON.parse(await encryptBackup(PAYLOAD, PASSPHRASE))
      const truncated = JSON.stringify({ ...parsed, tag: parsed.tag.slice(8) })

      await expect(decryptBackup(truncated, PASSPHRASE)).resolves.toStrictEqual(
        { status: 'invalid' }
      )
    })

    it.each([
      'argon2id:m=4194304,t=3,p=1',
      'argon2id:m=65536,t=1000,p=1',
      'scrypt:N=1048576,r=8,p=1',
      'pbkdf2:i=1000000000',
      'bcrypt:cost=12'
    ])('refuses the untrusted kdf %s', async (kdf) => {
      const parsed = JSON.parse(await encryptBackup(PAYLOAD, PASSPHRASE))

      await expect(
        decryptBackup(JSON.stringify({ ...parsed, kdf }), PASSPHRASE)
      ).resolves.toStrictEqual({ status: 'invalid' })
    })
  })

  describe('v1 restore', () => {
    it('decrypts the static v1 fixture', async () => {
      await expect(
        decryptBackup(V1_FIXTURE, PASSPHRASE)
      ).resolves.toStrictEqual({
        plaintext: V1_FIXTURE_PLAINTEXT,
        status: 'decrypted'
      })
    })

    it('decrypts the hex-ciphertext v1 fixture from pre-0.3.0 dev builds', async () => {
      await expect(
        decryptBackup(V1_HEX_CIPHER_FIXTURE, PASSPHRASE)
      ).resolves.toStrictEqual({
        plaintext: V1_FIXTURE_PLAINTEXT,
        status: 'decrypted'
      })
    })

    it('decrypts a backup written by the v1 export code', async () => {
      const backup = await encryptWithV1Format(PAYLOAD, PASSPHRASE)

      await expect(decryptBackup(backup, PASSPHRASE)).resolves.toStrictEqual({
        plaintext: PAYLOAD,
        status: 'decrypted'
      })
    })

    it('rejects a wrong passphrase', async () => {
      await expect(
        decryptBackup(V1_FIXTURE, WRONG_PASSPHRASE)
      ).resolves.toStrictEqual({ status: 'wrongPassphrase' })
    })
  })

  describe('unreadable input', () => {
    it('reports a newer format as unsupported', async () => {
      const future = JSON.stringify({ cipher: 'x', iv: 'y', salt: 'z', v: 3 })

      await expect(decryptBackup(future, PASSPHRASE)).resolves.toStrictEqual({
        status: 'unsupportedVersion'
      })
    })

    it.each([
      'not json',
      '{"cipher":"x","iv":"y","salt":"z"}',
      '{"cipher":"x","iv":"y","salt":"z","v":0}',
      '{"iv":"y","salt":"z","v":1}'
    ])('reports %s as invalid', async (raw) => {
      await expect(decryptBackup(raw, PASSPHRASE)).resolves.toStrictEqual({
        status: 'invalid'
      })
    })
  })
})
