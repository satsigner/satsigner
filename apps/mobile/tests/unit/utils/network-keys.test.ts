import { type Network } from '@/types/settings/blockchain'
import {
  convertKeyFormat,
  detectNetworkFromKey,
  getDerivationPathFromScriptVersion,
  getKeyFormatForScriptVersion,
  getMultisigDerivationPathFromScriptVersion,
  getNetworkKeyFormatName,
  getPubkeyExportFormats
} from '@/utils/bitcoin'
import { validateExtendedKey } from '@/utils/validation'

import { COSIGNERS } from './multisigDescriptorSamples'

// Account keys of the BIP-39 "abandon … about" mnemonic. The ypub and zpub
// are the published BIP-49 and BIP-84 vectors.
const BIP84_ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
const BIP84_XPUB =
  'xpub6CatWdiZiodmUeTDp8LT5or8nmbKNcuyvz7WyksVFkKB4RHwCD3XyuvPEbvqAQY3rAPshWcMLoP2fMFMKHPJ4ZeZXYVUhLv1VMrjPC7PW6V'
const BIP49_YPUB =
  'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
const BIP49_XPUB =
  'xpub6C6nQwHaWbSrzs5tZ1q7m5R9cPK9eYpNMFesiXsYrgc1P8bvLLAet9JfHjYXKjToD8cBRswJXXbbFpXgwsswVPAZzKMa1jUp2kVkGVUaJa7'
const [{ p2wsh: COSIGNER_TPUB }] = COSIGNERS
const COSIGNER_VPUB =
  'vpub5bEzW7qQeLAj252JMMM1EBEqJZzP62DuzmqnPxKVGDSQj4mZWwPct6oiyQD6rXiVrJVoVPXWceMjTdjaCE8B7HNWb2Pyrr5Wp3cLtPpRDHp'
const COSIGNER_UPUB =
  'upub5GQjCTAVVedFAmqBWzZP269L8bqw9QER5fKZcZRbtD4XfxxLGHE4G39axCFWrd4aSfNzjuvx9z1BaM81UXiAK3guighZGwG2YKYhVoW3VYR'

type ConversionCase = [string, string, Network, string]

const CONVERSION_CASES: ConversionCase[] = [
  ['zpub (BIP-84)', BIP84_ZPUB, 'bitcoin', BIP84_XPUB],
  ['ypub (BIP-49)', BIP49_YPUB, 'bitcoin', BIP49_XPUB],
  ['xpub', BIP84_XPUB, 'bitcoin', BIP84_XPUB],
  ['vpub', COSIGNER_VPUB, 'signet', COSIGNER_TPUB],
  ['upub', COSIGNER_UPUB, 'testnet', COSIGNER_TPUB],
  ['tpub', COSIGNER_TPUB, 'signet', COSIGNER_TPUB]
]

describe('network-aware key handling', () => {
  describe('validateExtendedKey', () => {
    it('should validate mainnet keys correctly', () => {
      // Test with valid prefixes (we're testing the prefix logic, not the actual key validity)
      expect(validateExtendedKey('xpub123456789abcdef', 'bitcoin')).toBe(true)
      expect(validateExtendedKey('ypub123456789abcdef', 'bitcoin')).toBe(true)
      expect(validateExtendedKey('zpub123456789abcdef', 'bitcoin')).toBe(true)

      // Invalid mainnet keys (testnet prefixes)
      expect(validateExtendedKey('tpub123456789abcdef', 'bitcoin')).toBe(false)
      expect(validateExtendedKey('upub123456789abcdef', 'bitcoin')).toBe(false)
      expect(validateExtendedKey('vpub123456789abcdef', 'bitcoin')).toBe(false)
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
      expect(getKeyFormatForScriptVersion('P2SH', 'bitcoin')).toBe('xpub')
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
      expect(getKeyFormatForScriptVersion('P2SH', 'testnet')).toBe('tpub')
    })

    it('should return correct formats for signet', () => {
      expect(getKeyFormatForScriptVersion('P2PKH', 'signet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'signet')).toBe('upub')
      expect(getKeyFormatForScriptVersion('P2WPKH', 'signet')).toBe('vpub')
      expect(getKeyFormatForScriptVersion('P2TR', 'signet')).toBe('vpub')
      expect(getKeyFormatForScriptVersion('P2WSH', 'signet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('P2SH-P2WSH', 'signet')).toBe('tpub')
      expect(getKeyFormatForScriptVersion('P2SH', 'signet')).toBe('tpub')
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
      expect(detectNetworkFromKey('')).toBeNull()
      expect(detectNetworkFromKey('invalid')).toBeNull()
      expect(detectNetworkFromKey('pub123456789abcdef')).toBeNull()
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

    it.each(CONVERSION_CASES)(
      'turns a %s into the plain extended key BDK accepts',
      (_format, key, network, expected) => {
        expect(convertKeyFormat(key, 'xpub', network)).toBe(expected)
      }
    )
  })
})

describe('button Label Generation', () => {
  it('should generate correct button labels for mainnet', () => {
    expect(getKeyFormatForScriptVersion('P2PKH', 'bitcoin')).toBe('xpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'bitcoin')).toBe('ypub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'bitcoin')).toBe('zpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'bitcoin')).toBe('vpub')
  })

  it('should generate correct button labels for testnet', () => {
    expect(getKeyFormatForScriptVersion('P2PKH', 'testnet')).toBe('tpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'testnet')).toBe('upub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'testnet')).toBe('vpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'testnet')).toBe('vpub')
  })

  it('should generate correct button labels for signet', () => {
    expect(getKeyFormatForScriptVersion('P2PKH', 'signet')).toBe('tpub')
    expect(getKeyFormatForScriptVersion('P2SH-P2WPKH', 'signet')).toBe('upub')
    expect(getKeyFormatForScriptVersion('P2WPKH', 'signet')).toBe('vpub')
    expect(getKeyFormatForScriptVersion('P2TR', 'signet')).toBe('vpub')
  })

  it('should generate correct translation keys for UI buttons', () => {
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
  it('should return correct derivation paths for mainnet', () => {
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
    expect(getDerivationPathFromScriptVersion('P2SH', 'bitcoin')).toBe(
      "45'/0'/0'"
    )
  })

  it('should return correct derivation paths for testnet', () => {
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
    expect(getDerivationPathFromScriptVersion('P2SH', 'testnet')).toBe(
      "45'/1'/0'"
    )
  })

  it('should return correct derivation paths for signet', () => {
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
    expect(getDerivationPathFromScriptVersion('P2SH', 'signet')).toBe(
      "45'/1'/0'"
    )
  })

  it('should return default derivation path for unknown script version', () => {
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

describe('getMultisigDerivationPathFromScriptVersion', () => {
  it('should return correct multisig derivation paths for mainnet', () => {
    expect(getMultisigDerivationPathFromScriptVersion('P2PKH', 'bitcoin')).toBe(
      "45'/0'/0'"
    )
    expect(
      getMultisigDerivationPathFromScriptVersion('P2SH-P2WPKH', 'bitcoin')
    ).toBe("48'/0'/0'/1'")
    expect(
      getMultisigDerivationPathFromScriptVersion('P2WPKH', 'bitcoin')
    ).toBe("48'/0'/0'/2'")
    expect(getMultisigDerivationPathFromScriptVersion('P2TR', 'bitcoin')).toBe(
      "86'/0'/0'"
    )
    expect(getMultisigDerivationPathFromScriptVersion('P2WSH', 'bitcoin')).toBe(
      "48'/0'/0'/2'"
    )
    expect(
      getMultisigDerivationPathFromScriptVersion('P2SH-P2WSH', 'bitcoin')
    ).toBe("48'/0'/0'/1'")
    expect(getMultisigDerivationPathFromScriptVersion('P2SH', 'bitcoin')).toBe(
      "45'/0'/0'"
    )
  })

  it('should return correct multisig derivation paths for testnet', () => {
    expect(getMultisigDerivationPathFromScriptVersion('P2PKH', 'testnet')).toBe(
      "45'/1'/0'"
    )
    expect(
      getMultisigDerivationPathFromScriptVersion('P2SH-P2WPKH', 'testnet')
    ).toBe("48'/1'/0'/1'")
    expect(
      getMultisigDerivationPathFromScriptVersion('P2WPKH', 'testnet')
    ).toBe("48'/1'/0'/2'")
    expect(getMultisigDerivationPathFromScriptVersion('P2TR', 'testnet')).toBe(
      "86'/1'/0'"
    )
    expect(getMultisigDerivationPathFromScriptVersion('P2WSH', 'testnet')).toBe(
      "48'/1'/0'/2'"
    )
    expect(
      getMultisigDerivationPathFromScriptVersion('P2SH-P2WSH', 'testnet')
    ).toBe("48'/1'/0'/1'")
    expect(getMultisigDerivationPathFromScriptVersion('P2SH', 'testnet')).toBe(
      "45'/1'/0'"
    )
  })

  it('should return correct multisig derivation paths for signet', () => {
    expect(getMultisigDerivationPathFromScriptVersion('P2PKH', 'signet')).toBe(
      "45'/1'/0'"
    )
    expect(
      getMultisigDerivationPathFromScriptVersion('P2SH-P2WPKH', 'signet')
    ).toBe("48'/1'/0'/1'")
    expect(getMultisigDerivationPathFromScriptVersion('P2WPKH', 'signet')).toBe(
      "48'/1'/0'/2'"
    )
    expect(getMultisigDerivationPathFromScriptVersion('P2TR', 'signet')).toBe(
      "86'/1'/0'"
    )
    expect(getMultisigDerivationPathFromScriptVersion('P2WSH', 'signet')).toBe(
      "48'/1'/0'/2'"
    )
    expect(
      getMultisigDerivationPathFromScriptVersion('P2SH-P2WSH', 'signet')
    ).toBe("48'/1'/0'/1'")
    expect(getMultisigDerivationPathFromScriptVersion('P2SH', 'signet')).toBe(
      "45'/1'/0'"
    )
  })

  it('should return default multisig derivation path for unknown script version', () => {
    expect(
      getMultisigDerivationPathFromScriptVersion('UNKNOWN', 'bitcoin')
    ).toBe("48'/0'/0'/2'")
    expect(
      getMultisigDerivationPathFromScriptVersion('UNKNOWN', 'testnet')
    ).toBe("48'/1'/0'/2'")
    expect(
      getMultisigDerivationPathFromScriptVersion('UNKNOWN', 'signet')
    ).toBe("48'/1'/0'/2'")
  })
})

describe('getPubkeyExportFormats', () => {
  it('offers only xpub for a legacy account', () => {
    expect(getPubkeyExportFormats('singlesig', 'P2PKH')).toStrictEqual(['xpub'])
  })

  it('offers the SLIP-132 format of the segwit script type', () => {
    expect(getPubkeyExportFormats('singlesig', 'P2WPKH')).toStrictEqual([
      'xpub',
      'zpub'
    ])
    expect(getPubkeyExportFormats('watchonly', 'P2SH-P2WPKH')).toStrictEqual([
      'xpub',
      'ypub'
    ])
  })

  it('offers only xpub for taproot, multisig and unknown script types', () => {
    expect(getPubkeyExportFormats('singlesig', 'P2TR')).toStrictEqual(['xpub'])
    expect(getPubkeyExportFormats('multisig', 'P2WPKH')).toStrictEqual(['xpub'])
    expect(getPubkeyExportFormats('watchonly', undefined)).toStrictEqual([
      'xpub'
    ])
  })
})

describe('getNetworkKeyFormatName', () => {
  it('names formats as each network writes them', () => {
    expect(getNetworkKeyFormatName('zpub', 'bitcoin')).toBe('zpub')
    expect(getNetworkKeyFormatName('zpub', 'signet')).toBe('vpub')
    expect(getNetworkKeyFormatName('ypub', 'testnet')).toBe('upub')
    expect(getNetworkKeyFormatName('xpub', 'signet')).toBe('tpub')
  })
})
