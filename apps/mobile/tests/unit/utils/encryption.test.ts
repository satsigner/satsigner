import crypto from 'react-native-aes-crypto'

import { aesDecrypt, aesEncrypt, doubleShaEncrypt } from '@/utils/crypto'

jest.mock('react-native-aes-crypto')

describe('encryption utils', () => {
  describe('aes', () => {
    it('should return correct AES encrypted output', async () => {
      const text = 'beef,beef,beef,beef,beef,beef,beef,beef,beef,beef,beef,beef'
      const key = '2009'

      const result = await aesEncrypt(text, key)

      expect(crypto.encrypt).toHaveBeenCalledWith(
        text,
        key,
        '7361747369676e65725f5f69766b6579',
        'aes-256-cbc'
      )
      expect(result).toBe(
        `encrypted:${text}:${key}:7361747369676e65725f5f69766b6579:aes-256-cbc`
      )
    })

    it('should return correct AES decrypted output', async () => {
      const ciphertext = '123satsigner321'
      const key = '2009'

      const result = await aesDecrypt(ciphertext, key)

      expect(crypto.decrypt).toHaveBeenCalledWith(
        ciphertext,
        key,
        '7361747369676e65725f5f69766b6579',
        'aes-256-cbc'
      )
      expect(result).toBe(
        `decrypted:${ciphertext}:${key}:7361747369676e65725f5f69766b6579:aes-256-cbc`
      )
    })
  })

  describe('double sha', () => {
    it('should return correct SHA265 hashed output', async () => {
      const text = 'satsigner'

      const result = await doubleShaEncrypt(text)

      expect(crypto.sha256).toHaveBeenCalledTimes(2)
      expect(crypto.sha256).toHaveBeenNthCalledWith(1, text)
      expect(crypto.sha256).toHaveBeenNthCalledWith(2, `hashed:${text}`)
      expect(result).toBe(`hashed:hashed:${text}`)
    })
  })
})
