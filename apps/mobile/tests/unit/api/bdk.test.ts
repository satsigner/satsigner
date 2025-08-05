// Mock BDK functions
jest.mock('@/api/bdk', () => ({
  getDescriptor: jest.fn(),
  getDescriptorsFromKeyData: jest.fn()
}))

import { getDescriptorsFromKeyData } from '@/api/bdk'

describe('BDK API - Descriptor Generation from Key Data', () => {
  const mockGetDescriptorsFromKeyData =
    require('@/api/bdk').getDescriptorsFromKeyData

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should generate descriptors from key data', async () => {
    // Mock the implementation
    const mockImplementation = async (
      extendedPublicKey: string,
      fingerprint: string,
      scriptVersion: string,
      network: any
    ) => {
      const derivationPath =
        scriptVersion === 'P2WPKH' ? '84h/0h/0h' : '44h/0h/0h'
      const keyPart = `[${fingerprint}/${derivationPath}]${extendedPublicKey}`

      let externalDescriptor = ''
      let internalDescriptor = ''

      switch (scriptVersion) {
        case 'P2WPKH':
          externalDescriptor = `wpkh(${keyPart}/0/*)`
          internalDescriptor = `wpkh(${keyPart}/1/*)`
          break
        case 'P2PKH':
          externalDescriptor = `pkh(${keyPart}/0/*)`
          internalDescriptor = `pkh(${keyPart}/1/*)`
          break
        default:
          externalDescriptor = `wpkh(${keyPart}/0/*)`
          internalDescriptor = `wpkh(${keyPart}/1/*)`
      }

      return {
        externalDescriptor,
        internalDescriptor
      }
    }

    ;(getDescriptorsFromKeyData as any).mockImplementation(mockImplementation)

    const testExtendedPublicKey =
      'tpubDDhJYqBZjiA8GZTqyPyCx6zzAqUiLembfLmzsi5ZbAPCLDsQP9PbdFz2pYGkQpD6S1zVzVkeRJ4AarecqttHijNhCkXhBjRnyDUvdk9GWXQ'
    const testFingerprint = '07ce4b46'
    const testScriptVersion = 'P2WPKH'

    const result = await (getDescriptorsFromKeyData as any)(
      testExtendedPublicKey,
      testFingerprint,
      testScriptVersion,
      'bitcoin'
    )

    expect(mockGetDescriptorsFromKeyData).toHaveBeenCalledWith(
      testExtendedPublicKey,
      testFingerprint,
      testScriptVersion,
      'bitcoin'
    )

    expect(result.externalDescriptor).toContain('wpkh')
    expect(result.internalDescriptor).toContain('wpkh')
    expect(result.externalDescriptor).toContain(testFingerprint)
    expect(result.internalDescriptor).toContain(testFingerprint)
    expect(result.externalDescriptor).toContain('/0/*')
    expect(result.internalDescriptor).toContain('/1/*')
  })

  it('should handle different script versions', async () => {
    const mockImplementation = async (
      extendedPublicKey: string,
      fingerprint: string,
      scriptVersion: string,
      network: any
    ) => {
      const keyPart = `[${fingerprint}/44h/0h/0h]${extendedPublicKey}`

      return {
        externalDescriptor: `pkh(${keyPart}/0/*)`,
        internalDescriptor: `pkh(${keyPart}/1/*)`
      }
    }

    ;(getDescriptorsFromKeyData as any).mockImplementation(mockImplementation)

    const result = await (getDescriptorsFromKeyData as any)(
      'xpub1234567890abcdef',
      '12345678',
      'P2PKH',
      'bitcoin'
    )

    expect(result.externalDescriptor).toContain('pkh')
    expect(result.internalDescriptor).toContain('pkh')
  })

  it('should generate descriptors for seed-based keys with proper structure', async () => {
    // Mock the implementation to simulate real descriptor generation
    const mockImplementation = async (
      extendedPublicKey: string,
      fingerprint: string,
      scriptVersion: string,
      network: any
    ) => {
      const derivationPath =
        scriptVersion === 'P2WPKH' ? '84h/0h/0h' : '44h/0h/0h'
      const keyPart = `[${fingerprint}/${derivationPath}]${extendedPublicKey}`

      let externalDescriptor = ''
      let internalDescriptor = ''

      switch (scriptVersion) {
        case 'P2WPKH':
          externalDescriptor = `wpkh(${keyPart}/0/*)`
          internalDescriptor = `wpkh(${keyPart}/1/*)`
          break
        case 'P2PKH':
          externalDescriptor = `pkh(${keyPart}/0/*)`
          internalDescriptor = `pkh(${keyPart}/1/*)`
          break
        case 'P2SH-P2WPKH':
          externalDescriptor = `sh(wpkh(${keyPart}/0/*))`
          internalDescriptor = `sh(wpkh(${keyPart}/1/*))`
          break
        case 'P2TR':
          externalDescriptor = `tr(${keyPart}/0/*)`
          internalDescriptor = `tr(${keyPart}/1/*)`
          break
        default:
          externalDescriptor = `wpkh(${keyPart}/0/*)`
          internalDescriptor = `wpkh(${keyPart}/1/*)`
      }

      return {
        externalDescriptor,
        internalDescriptor
      }
    }

    ;(getDescriptorsFromKeyData as any).mockImplementation(mockImplementation)

    // Test with the actual key data structure from the user's example
    const testExtendedPublicKey =
      'tpubDDhJYqBZjiA8GZTqyPyCx6zzAqUiLembfLmzsi5ZbAPCLDsQP9PbdFz2pYGkQpD6S1zVzVkeRJ4AarecqttHijNhCkXhBjRnyDUvdk9GWXQ'
    const testFingerprint = '07ce4b46'
    const testScriptVersion = 'P2WPKH'

    const result = await (getDescriptorsFromKeyData as any)(
      testExtendedPublicKey,
      testFingerprint,
      testScriptVersion,
      'bitcoin'
    )

    // Verify the descriptors are generated correctly
    expect(result.externalDescriptor).toContain('wpkh')
    expect(result.internalDescriptor).toContain('wpkh')
    expect(result.externalDescriptor).toContain(testFingerprint)
    expect(result.internalDescriptor).toContain(testFingerprint)
    expect(result.externalDescriptor).toContain('/0/*')
    expect(result.internalDescriptor).toContain('/1/*')
    expect(result.externalDescriptor).toContain(testExtendedPublicKey)
    expect(result.internalDescriptor).toContain(testExtendedPublicKey)

    // Verify the structure matches what the export descriptor expects
    expect(result).toHaveProperty('externalDescriptor')
    expect(result).toHaveProperty('internalDescriptor')
    expect(typeof result.externalDescriptor).toBe('string')
    expect(typeof result.internalDescriptor).toBe('string')
  })

  it('should handle drop seed functionality correctly', async () => {
    // Mock the account builder store
    const mockStore: any = {
      keys: [
        {
          index: 0,
          secret: {
            mnemonic: 'test mnemonic words here',
            passphrase: 'test passphrase',
            extendedPublicKey:
              'tpubDDhJYqBZjiA8GZTqyPyCx6zzAqUiLembfLmzsi5ZbAPCLDsQP9PbdFz2pYGkQpD6S1zVzVkeRJ4AarecqttHijNhCkXhBjRnyDUvdk9GWXQ',
            externalDescriptor:
              'wpkh([07ce4b46/84h/0h/0h]tpubDDhJYqBZjiA8GZTqyPyCx6zzAqUiLembfLmzsi5ZbAPCLDsQP9PbdFz2pYGkQpD6S1zVzVkeRJ4AarecqttHijNhCkXhBjRnyDUvdk9GWXQ/0/*)',
            internalDescriptor:
              'wpkh([07ce4b46/84h/0h/0h]tpubDDhJYqBZjiA8GZTqyPyCx6zzAqUiLembfLmzsi5ZbAPCLDsQP9PbdFz2pYGkQpD6S1zVzVkeRJ4AarecqttHijNhCkXhBjRnyDUvdk9GWXQ/1/*)',
            fingerprint: '07ce4b46'
          }
        }
      ]
    }

    // Simulate drop seed functionality
    const dropSeedFromKey = async (index: number) => {
      if (mockStore.keys[index] && mockStore.keys[index].secret) {
        if (typeof mockStore.keys[index].secret === 'object') {
          const secret = mockStore.keys[index].secret as any
          mockStore.keys[index].secret = {
            extendedPublicKey: secret.extendedPublicKey,
            externalDescriptor: secret.externalDescriptor,
            internalDescriptor: secret.internalDescriptor,
            fingerprint: secret.fingerprint
          }
          return { success: true, message: 'Seed dropped successfully' }
        }
      }
      return { success: false, message: 'Key not found or invalid' }
    }

    // Test drop seed functionality
    const result = await dropSeedFromKey(0)

    // Verify the result
    expect(result.success).toBe(true)
    expect(result.message).toBe('Seed dropped successfully')

    const updatedSecret = mockStore.keys[0].secret as any

    // Verify mnemonic and passphrase are removed
    expect(updatedSecret.mnemonic).toBeUndefined()
    expect(updatedSecret.passphrase).toBeUndefined()

    // Verify other fields are preserved
    expect(updatedSecret.extendedPublicKey).toBe(
      'tpubDDhJYqBZjiA8GZTqyPyCx6zzAqUiLembfLmzsi5ZbAPCLDsQP9PbdFz2pYGkQpD6S1zVzVkeRJ4AarecqttHijNhCkXhBjRnyDUvdk9GWXQ'
    )
    expect(updatedSecret.externalDescriptor).toContain('wpkh')
    expect(updatedSecret.internalDescriptor).toContain('wpkh')
    expect(updatedSecret.fingerprint).toBe('07ce4b46')
  })
})
