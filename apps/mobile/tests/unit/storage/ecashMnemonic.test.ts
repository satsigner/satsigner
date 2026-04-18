import * as SecureStore from 'expo-secure-store'

import {
  deleteEcashMnemonic,
  getEcashMnemonic,
  storeEcashMnemonic
} from '@/storage/encrypted'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStore: Record<string, string> = (SecureStore as any).__store

describe('ecash mnemonic storage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    for (const key of Object.keys(mockStore)) {
      delete mockStore[key]
    }
  })

  describe('storeEcashMnemonic', () => {
    it('stores mnemonic under versioned key', async () => {
      await storeEcashMnemonic('acc-1', 'word1 word2 word3')

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        '1_ecash_mnemonic.acc-1',
        'word1 word2 word3'
      )
    })

    it('stores different mnemonics for different accounts', async () => {
      await storeEcashMnemonic('acc-1', 'mnemonic one')
      await storeEcashMnemonic('acc-2', 'mnemonic two')

      expect(mockStore['1_ecash_mnemonic.acc-1']).toBe('mnemonic one')
      expect(mockStore['1_ecash_mnemonic.acc-2']).toBe('mnemonic two')
    })

    it('overwrites existing mnemonic for the same account', async () => {
      await storeEcashMnemonic('acc-1', 'old mnemonic')
      await storeEcashMnemonic('acc-1', 'new mnemonic')

      expect(mockStore['1_ecash_mnemonic.acc-1']).toBe('new mnemonic')
    })
  })

  describe('getEcashMnemonic', () => {
    it('returns stored mnemonic', async () => {
      await storeEcashMnemonic('acc-1', 'abandon ability able')

      const result = await getEcashMnemonic('acc-1')
      expect(result).toBe('abandon ability able')
    })

    it('returns null when no mnemonic exists', async () => {
      const result = await getEcashMnemonic('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('deleteEcashMnemonic', () => {
    it('removes stored mnemonic', async () => {
      await storeEcashMnemonic('acc-1', 'secret words')
      await deleteEcashMnemonic('acc-1')

      const result = await getEcashMnemonic('acc-1')
      expect(result).toBeNull()
    })

    it('does not affect other accounts', async () => {
      await storeEcashMnemonic('acc-1', 'mnemonic one')
      await storeEcashMnemonic('acc-2', 'mnemonic two')

      await deleteEcashMnemonic('acc-1')

      await expect(getEcashMnemonic('acc-1')).resolves.toBeNull()
      await expect(getEcashMnemonic('acc-2')).resolves.toBe('mnemonic two')
    })
  })
})
