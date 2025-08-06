import {
  convertKeyFormat,
  convertKeyForNetwork,
  detectNetworkFromKey,
  getDerivationPathFromScriptVersion,
  getKeyFormatForScriptVersion
} from '@/utils/bitcoin'
import { validateExtendedKey } from '@/utils/validation'

describe('Network-aware key handling', () => {
  describe('validateExtendedKey', () => {
    it('should validate mainnet keys correctly', () => {
      // Test with valid prefixes (we're testing the prefix logic, not the actual key validity)
      expect(validateExtendedKey('xpub123456789abcdef', 'bitcoin')).toBe(true)
      expect(validateExtendedKey('ypub123456789abcdef', 'bitcoin')).toBe(true)
      expect(validateExtendedKey('zpub123456789abcdef', 'bitcoin')).toBe(true)
      expect(validateExtendedKey('vpub123456789abcdef', 'bitcoin')).toBe(true)

      // Invalid mainnet keys (testnet prefixes)
      expect(validateExtendedKey('tpub123456789abcdef', 'bitcoin')).toBe(false)
      expect(validateExtendedKey('upub123456789abcdef', 'bitcoin')).toBe(false)
    })

    it('should validate testnet keys correctly', () => {
      // Valid testnet keys
      expect(validateExtendedKey('tpub123456789abcdef', 'testnet')).toBe(true)
      expect(validateExtendedKey('upub123456789abcdef', 'testnet')).toBe(true)
      expect(validateExtendedKey('vpub123456789abcdef', 'testnet')).toBe(true)

      // Invalid testnet keys (mainnet prefixes)
      expect(validateExtendedKey('xpub123456789abcdef', 'testnet')).toBe(false)
      expect(validateExtendedKey('ypub123456789abcdef', 'testnet')).toBe(false)
      expect(validateExtendedKey('zpub123456789abcdef', 'testnet')).toBe(false)
    })

    it('should validate signet keys correctly', () => {
      // Valid signet keys (same as testnet)
      expect(validateExtendedKey('tpub123456789abcdef', 'signet')).toBe(true)
      expect(validateExtendedKey('upub123456789abcdef', 'signet')).toBe(true)
      expect(validateExtendedKey('vpub123456789abcdef', 'signet')).toBe(true)

      // Invalid signet keys (mainnet prefixes)
      expect(validateExtendedKey('xpub123456789abcdef', 'signet')).toBe(false)
      expect(validateExtendedKey('ypub123456789abcdef', 'signet')).toBe(false)
    })

    it('should fallback to original validation when no network is provided', () => {
      // Should accept all valid prefixes when no network is specified
      expect(validateExtendedKey('xpub123456789abcdef')).toBe(true)
      expect(validateExtendedKey('tpub123456789abcdef')).toBe(true)
      expect(validateExtendedKey('ypub123456789abcdef')).toBe(true)
      expect(validateExtendedKey('upub123456789abcdef')).toBe(true)
    })
  })

  describe('getKeyFormatForScriptVersion', () => {
    it('should return correct formats for mainnet', () => {
      expect(getKeyFormatForScriptVersion('P2PKH', 'bitcoin')).toBe('xpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'bitcoin')).toBe(
        'ypub'
      )
      expect(getKeyFormatForScriptVersion('P2WPKH', 'bitcoin')).toBe('zpub')
      expect(getKeyFormatForScriptVersion('P2TR', 'bitcoin')).toBe('vpub')
      expect(getKeyFormatForScriptVersion('P2WSH', 'bitcoin')).toBe('xpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WSH', 'bitcoin')).toBe('xpub')
      expect(getKeyFormatForScriptVersion('Legacy P2SH', 'bitcoin')).toBe('xpub')
    })

    it('should return correct formats for testnet', () => {
      expect(getKeyFormatForScriptVersion('P2PKH', 'testnet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'testnet')).toBe(
        'upub'
      )
      expect(getKeyFormatForScriptVersion('P2WPKH', 'testnet')).toBe('vpub')
      expect(getKeyFormatForScriptVersion('P2TR', 'testnet')).toBe('vpub')
      expect(getKeyFormatForScriptVersion('P2WSH', 'testnet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WSH', 'testnet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('Legacy P2SH', 'testnet')).toBe('tpub')
    })

    it('should return correct formats for signet', () => {
      expect(getKeyFormatForScriptVersion('P2PKH', 'signet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'signet')).toBe('upub')
      expect(getKeyFormatForScriptVersion('P2WPKH', 'signet')).toBe('vpub')
      expect(getKeyFormatForScriptVersion('P2TR', 'signet')).toBe('vpub')
      expect(getKeyFormatForScriptVersion('P2WSH', 'signet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WSH', 'signet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('Legacy P2SH', 'signet')).toBe('tpub')
    })
  })

  describe('detectNetworkFromKey', () => {
    it('should detect mainnet from key prefixes', () => {
      expect(detectNetworkFromKey('xpub123456789abcdef')).toBe('bitcoin')
      expect(detectNetworkFromKey('ypub123456789abcdef')).toBe('bitcoin')
      expect(detectNetworkFromKey('zpub123456789abcdef')).toBe('bitcoin')
      // Note: vpub can be both mainnet and testnet, so we need to be careful with this test
      // For now, we'll test with a clear mainnet prefix
    })

    it('should detect testnet from key prefixes', () => {
      expect(detectNetworkFromKey('tpub123456789abcdef')).toBe('testnet')
      expect(detectNetworkFromKey('upub123456789abcdef')).toBe('testnet')
      // Note: vpub can be both mainnet and testnet, so we'll test with clear testnet prefixes
    })

    it('should return null for invalid keys', () => {
      expect(detectNetworkFromKey('')).toBe(null)
      expect(detectNetworkFromKey('invalid')).toBe(null)
      expect(detectNetworkFromKey('pub123456789abcdef')).toBe(null)
    })
  })

  describe('convertKeyFormat', () => {
    it('should handle invalid inputs gracefully', () => {
      expect(convertKeyFormat('', 'xpub', 'bitcoin')).toBe('')
      expect(convertKeyFormat('invalid', 'xpub', 'bitcoin')).toBe('invalid')
      expect(convertKeyFormat('xpub123456789abcdef', '', 'bitcoin')).toBe(
        'xpub123456789abcdef'
      )
    })

    it('should return original key for invalid base58check keys', () => {
      // Test with invalid keys that have correct prefixes but invalid checksums
      const invalidKey = 'xpub123456789abcdef'
      expect(convertKeyFormat(invalidKey, 'ypub', 'bitcoin')).toBe(invalidKey)
    })
  })

  describe('convertKeyForNetwork', () => {
    it('should handle invalid inputs gracefully', () => {
      expect(convertKeyForNetwork('', 'testnet')).toBe('')
      expect(convertKeyForNetwork('invalid', 'testnet')).toBe('invalid')
    })

    it('should not convert when source and target networks are the same', () => {
      const mainnetXpub = 'xpub123456789abcdef'
      expect(convertKeyForNetwork(mainnetXpub, 'bitcoin')).toBe(mainnetXpub)

      const testnetTpub = 'tpub123456789abcdef'
      expect(convertKeyForNetwork(testnetTpub, 'testnet')).toBe(testnetTpub)
    })

    it('should return original key for invalid keys', () => {
      const invalidKey = 'xpub123456789abcdef'
      expect(convertKeyForNetwork(invalidKey, 'testnet')).toBe(invalidKey)
    })
  })
})

describe('Button Label Generation', () => {
  test('should generate correct button labels for mainnet', () => {
    expect(getKeyFormatForScriptVersion('P2PKH', 'bitcoin')).toBe('xpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'bitcoin')).toBe('ypub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'bitcoin')).toBe('zpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'bitcoin')).toBe('vpub')
  })

  test('should generate correct button labels for testnet', () => {
    expect(getKeyFormatForScriptVersion('P2PKH', 'testnet')).toBe('tpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'testnet')).toBe('upub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'testnet')).toBe('vpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'testnet')).toBe('vpub')
  })

  test('should generate correct button labels for signet', () => {
    expect(getKeyFormatForScriptVersion('P2PKH', 'signet')).toBe('tpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'signet')).toBe('upub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'signet')).toBe('vpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'signet')).toBe('vpub')
  })

  test('should generate correct translation keys for UI buttons', () => {
    // Test that the function returns the correct format for translation keys
    expect(getKeyFormatForScriptVersion('P2PKH', 'bitcoin')).toBe('xpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'bitcoin')).toBe('ypub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'bitcoin')).toBe('zpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'bitcoin')).toBe('vpub')

    expect(getKeyFormatForScriptVersion('P2PKH', 'testnet')).toBe('tpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'testnet')).toBe('upub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'testnet')).toBe('vpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'testnet')).toBe('vpub')
  })
})

describe('getDerivationPathFromScriptVersion', () => {
  test('should return correct derivation paths for mainnet', () => {
    expect(getDerivationPathFromScriptVersion('P2PKH', 'bitcoin')).toBe(
      "44'/0'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2SH-P2WPKH', 'bitcoin')).toBe(
      "49'/0'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2WPKH', 'bitcoin')).toBe(
      "84'/0'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2TR', 'bitcoin')).toBe(
      "86'/0'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2WSH', 'bitcoin')).toBe(
      "48'/0'/0'/2'"
    )
    expect(getDerivationPathFromScriptVersion('P2SH-P2WSH', 'bitcoin')).toBe(
      "48'/0'/0'/1'"
    )
    expect(getDerivationPathFromScriptVersion('Legacy P2SH', 'bitcoin')).toBe(
      "45'/0'/0'"
    )
  })

  test('should return correct derivation paths for testnet', () => {
    expect(getDerivationPathFromScriptVersion('P2PKH', 'testnet')).toBe(
      "44'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2SH-P2WPKH', 'testnet')).toBe(
      "49'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2WPKH', 'testnet')).toBe(
      "84'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2TR', 'testnet')).toBe(
      "86'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2WSH', 'testnet')).toBe(
      "48'/1'/0'/2'"
    )
    expect(getDerivationPathFromScriptVersion('P2SH-P2WSH', 'testnet')).toBe(
      "48'/1'/0'/1'"
    )
    expect(getDerivationPathFromScriptVersion('Legacy P2SH', 'testnet')).toBe(
      "45'/1'/0'"
    )
  })

  test('should return correct derivation paths for signet', () => {
    expect(getDerivationPathFromScriptVersion('P2PKH', 'signet')).toBe(
      "44'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2SH-P2WPKH', 'signet')).toBe(
      "49'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2WPKH', 'signet')).toBe(
      "84'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2TR', 'signet')).toBe(
      "86'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('P2WSH', 'signet')).toBe(
      "48'/1'/0'/2'"
    )
    expect(getDerivationPathFromScriptVersion('P2SH-P2WSH', 'signet')).toBe(
      "48'/1'/0'/1'"
    )
    expect(getDerivationPathFromScriptVersion('Legacy P2SH', 'signet')).toBe(
      "45'/1'/0'"
    )
  })

  test('should return default derivation path for unknown script version', () => {
    expect(getDerivationPathFromScriptVersion('UNKNOWN', 'bitcoin')).toBe(
      "84'/0'/0'"
    )
    expect(getDerivationPathFromScriptVersion('UNKNOWN', 'testnet')).toBe(
      "84'/1'/0'"
    )
    expect(getDerivationPathFromScriptVersion('UNKNOWN', 'signet')).toBe(
      "84'/1'/0'"
    )
  })
})
