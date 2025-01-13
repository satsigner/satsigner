import crypto from 'react-native-aes-crypto'

import { aesEncrypt, aesDecrypt, doubleShaEncrypt } from '@/utils/crypto'

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
        'satsigner',
        'aes-256-cbc'
      )
      expect(result).toBe(`encrypted:${text}:${key}:satsigner:aes-256-cbc`)
    })

    it('should return correct AES decrypted output', async () => {
      const ciphertext = '123satsigner321'
      const key = '2009'

      const result = await aesDecrypt(ciphertext, key)

      expect(crypto.decrypt).toHaveBeenCalledWith(
        ciphertext,
        key,
        'satsigner',
        'aes-256-cbc'
      )
      expect(result).toBe(
        `decrypted:${ciphertext}:${key}:satsigner:aes-256-cbc`
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
