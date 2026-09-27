import QuickCrypto from 'react-native-quick-crypto'

import {
  aesDecrypt,
  aesEncrypt,
  aesReEncrypt,
  doubleShaEncrypt,
  pbkdf2Encrypt,
  sha256
} from '@/utils/crypto'

describe('encryption utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('aes', () => {
    it('should encrypt text with AES-256-CBC', async () => {
      const text = 'beef,beef,beef,beef,beef,beef,beef,beef,beef,beef,beef,beef'
      const key = '0'.repeat(64)
      const iv = '7361747369676e65725f5f69766b6579'

      const result = await aesEncrypt(text, key, iv)

      expect(QuickCrypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-cbc',
        expect.any(Uint8Array),
        expect.any(Uint8Array)
      )
      expect(typeof result).toBe('string')
    })

    it('should decrypt ciphertext with AES-256-CBC', async () => {
      const ciphertext = 'abcdef0123456789'
      const key = '0'.repeat(64)
      const iv = '7361747369676e65725f5f69766b6579'

      const result = await aesDecrypt(ciphertext, key, iv)

      expect(QuickCrypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-cbc',
        expect.any(Uint8Array),
        expect.any(Uint8Array)
      )
      expect(typeof result).toBe('string')
    })
  })

  describe('aesReEncrypt', () => {
    it('decrypts with the old key and encrypts with the new key and a fresh iv', async () => {
      const oldKey = '0'.repeat(64)
      const newKey = '1'.repeat(64)
      const stored = {
        iv: '7361747369676e65725f5f69766b6579',
        secret: 'abcdef0123456789'
      }

      const moved = await aesReEncrypt(stored, oldKey, newKey)

      expect(QuickCrypto.createDecipheriv).toHaveBeenCalledWith(
        'aes-256-cbc',
        new Uint8Array(Buffer.from(oldKey, 'hex')),
        new Uint8Array(Buffer.from(stored.iv, 'hex'))
      )
      expect(QuickCrypto.createCipheriv).toHaveBeenCalledWith(
        'aes-256-cbc',
        new Uint8Array(Buffer.from(newKey, 'hex')),
        new Uint8Array(Buffer.from(moved.iv, 'hex'))
      )
      expect(moved.iv).not.toBe(stored.iv)
      expect(typeof moved.secret).toBe('string')
    })
  })

  describe('pbkdf2', () => {
    it('should derive key with PBKDF2', async () => {
      const pin = '2009'
      const salt = '736174736'

      const result = await pbkdf2Encrypt(pin, salt)

      expect(QuickCrypto.pbkdf2Sync).toHaveBeenCalledWith(
        pin,
        salt,
        10_000,
        32,
        'sha256'
      )
      expect(typeof result).toBe('string')
    })
  })

  describe('double sha', () => {
    it('should hash text twice with SHA256', async () => {
      const text = 'satsigner'

      const result = await doubleShaEncrypt(text)

      expect(QuickCrypto.createHash).toHaveBeenCalledTimes(2)
      expect(typeof result).toBe('string')
    })
  })

  describe('sha256', () => {
    it('should return hex hash', async () => {
      const result = await sha256('test')

      expect(QuickCrypto.createHash).toHaveBeenCalledWith('sha256')
      expect(typeof result).toBe('string')
    })
  })
})
