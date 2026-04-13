import * as SecureStore from 'expo-secure-store'

import {
  deleteAllKeySecrets,
  deleteKeySecret,
  getKeySecret,
  storeKeySecret
} from '@/storage/encrypted'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStore: Record<string, string> = (SecureStore as any).__store

describe('encrypted storage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key]
    }
  })

  describe('storeKeySecret', () => {
    it('stores secret and iv under versioned keys', async () => {
      await storeKeySecret('acc-1', 0, 'encrypted-secret', 'iv-value')

      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2)
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        '1_key_secret.acc-1.0',
        'encrypted-secret'
      )
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        '1_key_iv.acc-1.0',
        'iv-value'
      )
    })

    it('handles different key indices', async () => {
      await storeKeySecret('acc-1', 2, 'secret-2', 'iv-2')

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        '1_key_secret.acc-1.2',
        'secret-2'
      )
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        '1_key_iv.acc-1.2',
        'iv-2'
      )
    })
  })

  describe('getKeySecret', () => {
    it('returns secret and iv when both exist', async () => {
      await storeKeySecret('acc-1', 0, 'my-secret', 'my-iv')
      const result = await getKeySecret('acc-1', 0)

      expect(result).toStrictEqual({ iv: 'my-iv', secret: 'my-secret' })
    })

    it('returns null when secret is missing', async () => {
      const result = await getKeySecret('acc-1', 99)
      expect(result).toBeNull()
    })

    it('returns null when iv is missing but secret exists', async () => {
      await SecureStore.setItemAsync('1_key_secret.acc-1.0', 'orphan-secret')
      const result = await getKeySecret('acc-1', 0)
      expect(result).toBeNull()
    })
  })

  describe('deleteKeySecret', () => {
    it('deletes both secret and iv entries', async () => {
      await storeKeySecret('acc-1', 0, 'secret', 'iv')
      await deleteKeySecret('acc-1', 0)

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        '1_key_secret.acc-1.0'
      )
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        '1_key_iv.acc-1.0'
      )
    })

    it('confirms data is gone after delete', async () => {
      await storeKeySecret('acc-1', 0, 'secret', 'iv')
      await deleteKeySecret('acc-1', 0)
      const result = await getKeySecret('acc-1', 0)
      expect(result).toBeNull()
    })
  })

  describe('deleteAllKeySecrets', () => {
    it('deletes secrets for all key indices', async () => {
      await storeKeySecret('acc-1', 0, 'secret-0', 'iv-0')
      await storeKeySecret('acc-1', 1, 'secret-1', 'iv-1')
      await storeKeySecret('acc-1', 2, 'secret-2', 'iv-2')

      await deleteAllKeySecrets('acc-1', 3)

      const result0 = await getKeySecret('acc-1', 0)
      const result1 = await getKeySecret('acc-1', 1)
      const result2 = await getKeySecret('acc-1', 2)

      expect(result0).toBeNull()
      expect(result1).toBeNull()
      expect(result2).toBeNull()
    })

    it('handles keyCount of 0', async () => {
      await deleteAllKeySecrets('acc-1', 0)
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled()
    })

    it('does not affect other accounts', async () => {
      await storeKeySecret('acc-1', 0, 'secret-1', 'iv-1')
      await storeKeySecret('acc-2', 0, 'secret-2', 'iv-2')

      await deleteAllKeySecrets('acc-1', 1)

      const result1 = await getKeySecret('acc-1', 0)
      const result2 = await getKeySecret('acc-2', 0)

      expect(result1).toBeNull()
      expect(result2).toStrictEqual({ iv: 'iv-2', secret: 'secret-2' })
    })
  })
})
