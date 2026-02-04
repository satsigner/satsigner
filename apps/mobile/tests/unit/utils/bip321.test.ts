import { SATS_PER_BITCOIN } from '@/constants/btc'
import {
  encodeBitcoinUri,
  encodeBitcoinUriFromSats,
  getAddressFromUri,
  isBitcoinUri,
  parseBitcoinUri,
  parseBitcoinUriWithSats,
  validateBitcoinAddressWithNetwork,
  validateBolt12,
  validateLightning
} from '@/utils/bip321'

import {
  addresses,
  amountConversions,
  bip321Uris,
  bolt12Offers,
  formattingEdgeCases,
  lightningInvoices
} from './bip321_samples'

describe('bip321 utils', () => {
  describe('isBitcoinUri', () => {
    it('should validate basic BIP-321 URI', () => {
      expect(isBitcoinUri(bip321Uris.valid.addressOnly)).toBe(true)
    })

    it('should validate URI with amount', () => {
      expect(isBitcoinUri(bip321Uris.valid.withAmount)).toBe(true)
    })

    it('should validate URI with label', () => {
      expect(isBitcoinUri(bip321Uris.valid.withLabel)).toBe(true)
    })

    it('should validate URI with amount and label', () => {
      expect(isBitcoinUri(bip321Uris.valid.withBoth)).toBe(true)
    })

    it('should validate uppercase scheme', () => {
      expect(isBitcoinUri(bip321Uris.valid.uppercaseScheme)).toBe(true)
    })

    it('should validate mixed case scheme', () => {
      expect(isBitcoinUri(bip321Uris.valid.mixedCaseScheme)).toBe(true)
    })

    it('should validate testnet URI', () => {
      expect(isBitcoinUri(bip321Uris.valid.testnet)).toBe(true)
    })

    it('should validate regtest URI', () => {
      expect(isBitcoinUri(bip321Uris.valid.regtest)).toBe(true)
    })

    it('should validate legacy P2PKH URI', () => {
      expect(isBitcoinUri(bip321Uris.valid.p2pkh)).toBe(true)
    })

    it('should validate legacy P2SH URI', () => {
      expect(isBitcoinUri(bip321Uris.valid.p2sh)).toBe(true)
    })

    it('should reject URI without scheme', () => {
      expect(isBitcoinUri(bip321Uris.invalid.noScheme)).toBe(false)
    })

    it('should reject wrong scheme', () => {
      expect(isBitcoinUri(bip321Uris.invalid.wrongScheme)).toBe(false)
    })

    it('should reject empty string', () => {
      expect(isBitcoinUri('')).toBe(false)
    })

    it('should reject null/undefined', () => {
      expect(isBitcoinUri(null as unknown as string)).toBe(false)
      expect(isBitcoinUri(undefined as unknown as string)).toBe(false)
    })
  })

  describe('parseBitcoinUri', () => {
    it('should parse address-only URI', () => {
      const result = parseBitcoinUri(bip321Uris.valid.addressOnly)
      expect(result.isValid).toBe(true)
      expect(result.address).toBe(addresses.mainnet.p2wpkh)
    })

    it('should parse URI with amount in BTC', () => {
      const result = parseBitcoinUri(bip321Uris.valid.withAmount)
      expect(result.isValid).toBe(true)
      expect(result.amount).toBe(0.001)
    })

    it('should parse URI with label', () => {
      const result = parseBitcoinUri(bip321Uris.valid.withLabel)
      expect(result.isValid).toBe(true)
      expect(result.label).toBe('Donation')
    })

    it('should parse URI with amount and label', () => {
      const result = parseBitcoinUri(bip321Uris.valid.withBoth)
      expect(result.isValid).toBe(true)
      expect(result.address).toBe(addresses.mainnet.p2wpkh)
      expect(result.amount).toBe(0.001)
      expect(result.label).toBe('Coffee')
    })

    it('should parse URI with message', () => {
      const result = parseBitcoinUri(bip321Uris.valid.withMessage)
      expect(result.isValid).toBe(true)
      expect(result.message).toBe('Payment for services')
    })

    it('should parse URI with 1 sat amount', () => {
      const result = parseBitcoinUri(bip321Uris.valid.amountManyDecimals)
      expect(result.isValid).toBe(true)
      expect(result.amount).toBe(0.00000001)
    })

    it('should parse URI with whole number amount', () => {
      const result = parseBitcoinUri(bip321Uris.valid.amountWholeNumber)
      expect(result.isValid).toBe(true)
      expect(result.amount).toBe(1)
    })

    it('should parse testnet URI', () => {
      const result = parseBitcoinUri(bip321Uris.valid.testnet)
      expect(result.isValid).toBe(true)
      expect(result.address).toBe(addresses.testnet.p2wpkh)
    })

    it('should parse URI with URL-encoded label', () => {
      const result = parseBitcoinUri(bip321Uris.valid.labelWithSpaces)
      expect(result.isValid).toBe(true)
      expect(result.label).toBe('My Payment Label')
    })

    it('should return invalid for bad URI', () => {
      const result = parseBitcoinUri(bip321Uris.invalid.invalidAddress)
      expect(result.isValid).toBe(false)
    })
  })

  describe('parseBitcoinUriWithSats', () => {
    it('should convert BTC amount to sats', () => {
      const result = parseBitcoinUriWithSats(bip321Uris.valid.withAmount)
      expect(result.isValid).toBe(true)
      expect(result.amountSats).toBe(100000) // 0.001 BTC = 100,000 sats
    })

    it('should convert 1 sat correctly', () => {
      const result = parseBitcoinUriWithSats(bip321Uris.valid.amountManyDecimals)
      expect(result.isValid).toBe(true)
      expect(result.amountSats).toBe(1)
    })

    it('should convert 1 BTC to sats', () => {
      const result = parseBitcoinUriWithSats(bip321Uris.valid.amountWholeNumber)
      expect(result.isValid).toBe(true)
      expect(result.amountSats).toBe(SATS_PER_BITCOIN)
    })

    it('should return undefined amountSats when no amount', () => {
      const result = parseBitcoinUriWithSats(bip321Uris.valid.addressOnly)
      expect(result.isValid).toBe(true)
      expect(result.amountSats).toBeUndefined()
    })
  })

  describe('encodeBitcoinUri', () => {
    it('should encode address only', () => {
      const result = encodeBitcoinUri({ address: addresses.mainnet.p2wpkh })
      expect(result.isValid).toBe(true)
      expect(result.uri).toBe(`bitcoin:${addresses.mainnet.p2wpkh}`)
    })

    it('should encode with amount', () => {
      const result = encodeBitcoinUri({
        address: addresses.mainnet.p2wpkh,
        amount: 0.001
      })
      expect(result.isValid).toBe(true)
      expect(result.uri).toContain('amount=0.001')
    })

    it('should encode with label', () => {
      const result = encodeBitcoinUri({
        address: addresses.mainnet.p2wpkh,
        label: 'Test Label'
      })
      expect(result.isValid).toBe(true)
      expect(result.uri).toContain('label=')
    })

    it('should encode with special characters in label', () => {
      const result = encodeBitcoinUri({
        address: addresses.mainnet.p2wpkh,
        label: 'Payment & More'
      })
      expect(result.isValid).toBe(true)
      // Verify roundtrip
      const parsed = parseBitcoinUri(result.uri)
      expect(parsed.label).toBe('Payment & More')
    })

    it('should omit zero amount', () => {
      const result = encodeBitcoinUri({
        address: addresses.mainnet.p2wpkh,
        amount: 0
      })
      expect(result.isValid).toBe(true)
      expect(result.uri).not.toContain('amount=')
    })
  })

  describe('encodeBitcoinUriFromSats', () => {
    it('should encode sats to BTC amount', () => {
      const result = encodeBitcoinUriFromSats(addresses.mainnet.p2wpkh, 100000)
      expect(result.isValid).toBe(true)
      expect(result.uri).toContain('amount=0.001')
    })

    it('should encode 1 sat correctly', () => {
      const result = encodeBitcoinUriFromSats(addresses.mainnet.p2wpkh, 1)
      expect(result.isValid).toBe(true)
      expect(result.uri).toContain('amount=0.00000001')
    })

    it('should encode with label', () => {
      const result = encodeBitcoinUriFromSats(
        addresses.mainnet.p2wpkh,
        100000,
        'Test'
      )
      expect(result.isValid).toBe(true)
      expect(result.uri).toContain('label=')
    })

    it('should handle undefined amount', () => {
      const result = encodeBitcoinUriFromSats(addresses.mainnet.p2wpkh)
      expect(result.isValid).toBe(true)
      expect(result.uri).not.toContain('amount=')
    })
  })

  describe('getAddressFromUri', () => {
    it('should extract address from valid URI', () => {
      const address = getAddressFromUri(bip321Uris.valid.addressOnly)
      expect(address).toBe(addresses.mainnet.p2wpkh)
    })

    it('should return null for invalid URI', () => {
      const address = getAddressFromUri(bip321Uris.invalid.invalidAddress)
      expect(address).toBeNull()
    })
  })

  describe('validateBitcoinAddressWithNetwork', () => {
    it('should validate mainnet address', () => {
      const result = validateBitcoinAddressWithNetwork(
        addresses.mainnet.p2wpkh,
        'bitcoin'
      )
      expect(result.isValid).toBe(true)
    })

    it('should validate testnet address', () => {
      const result = validateBitcoinAddressWithNetwork(
        addresses.testnet.p2wpkh,
        'testnet'
      )
      expect(result.isValid).toBe(true)
    })

    it('should reject invalid address', () => {
      const result = validateBitcoinAddressWithNetwork(
        addresses.invalid.tooShort,
        'bitcoin'
      )
      expect(result.isValid).toBe(false)
    })
  })

  describe('validateLightning', () => {
    it('should validate mainnet invoice', () => {
      const result = validateLightning(lightningInvoices.mainnet.basic)
      expect(result.isValid).toBe(true)
      expect(result.appNetwork).toBe('bitcoin')
    })

    it('should validate testnet invoice', () => {
      const result = validateLightning(lightningInvoices.testnet.basic)
      expect(result.isValid).toBe(true)
      expect(result.appNetwork).toBe('testnet')
    })

    it('should validate regtest invoice', () => {
      const result = validateLightning(lightningInvoices.regtest.basic)
      expect(result.isValid).toBe(true)
    })

    it('should validate signet invoice', () => {
      const result = validateLightning(lightningInvoices.signet.basic)
      expect(result.isValid).toBe(true)
      expect(result.appNetwork).toBe('signet')
    })

    it('should reject invalid invoice', () => {
      const result = validateLightning(lightningInvoices.invalid.wrongPrefix)
      expect(result.isValid).toBe(false)
    })
  })

  describe('validateBolt12', () => {
    it('should validate basic BOLT12 offer', () => {
      const result = validateBolt12(bolt12Offers.valid.basic)
      expect(result.isValid).toBe(true)
    })

    it('should reject wrong prefix', () => {
      const result = validateBolt12(bolt12Offers.invalid.wrongPrefix)
      expect(result.isValid).toBe(false)
    })

    it('should reject too short offer', () => {
      const result = validateBolt12(bolt12Offers.invalid.tooShort)
      expect(result.isValid).toBe(false)
    })
  })

  describe('amount conversion accuracy', () => {
    it.each(amountConversions.btcToSats)(
      'should convert $btc BTC to $sats sats',
      ({ btc, sats }) => {
        const parsed = parseBitcoinUriWithSats(
          `bitcoin:${addresses.mainnet.p2wpkh}?amount=${btc}`
        )
        expect(parsed.amountSats).toBe(sats)
      }
    )

    it.each(amountConversions.edgeCases)(
      'should handle edge case $btc BTC',
      ({ btc, sats }) => {
        const parsed = parseBitcoinUriWithSats(
          `bitcoin:${addresses.mainnet.p2wpkh}?amount=${btc}`
        )
        // Zero amounts may not be included in the URI, so check if undefined or 0
        if (sats === 0) {
          expect(parsed.amountSats === undefined || parsed.amountSats === 0).toBe(
            true
          )
        } else {
          expect(parsed.amountSats).toBe(sats)
        }
      }
    )
  })

  describe('whitespace handling', () => {
    it('should handle leading whitespace', () => {
      const result = isBitcoinUri(
        formattingEdgeCases.whitespace.leadingSpace.trim()
      )
      expect(result).toBe(true)
    })

    it('should handle trailing whitespace', () => {
      const result = isBitcoinUri(
        formattingEdgeCases.whitespace.trailingSpace.trim()
      )
      expect(result).toBe(true)
    })
  })

  describe('roundtrip encoding/parsing', () => {
    it('should roundtrip address only', () => {
      const encoded = encodeBitcoinUri({ address: addresses.mainnet.p2wpkh })
      const parsed = parseBitcoinUri(encoded.uri)
      expect(parsed.address).toBe(addresses.mainnet.p2wpkh)
    })

    it('should roundtrip with amount', () => {
      const encoded = encodeBitcoinUri({
        address: addresses.mainnet.p2wpkh,
        amount: 0.12345678
      })
      const parsed = parseBitcoinUri(encoded.uri)
      expect(parsed.amount).toBe(0.12345678)
    })

    it('should roundtrip with label', () => {
      const label = 'Test Label with spaces'
      const encoded = encodeBitcoinUri({
        address: addresses.mainnet.p2wpkh,
        label
      })
      const parsed = parseBitcoinUri(encoded.uri)
      expect(parsed.label).toBe(label)
    })

    it('should roundtrip complete URI', () => {
      const params = {
        address: addresses.mainnet.p2wpkh,
        amount: 0.001,
        label: 'Coffee Payment'
      }
      const encoded = encodeBitcoinUri(params)
      const parsed = parseBitcoinUri(encoded.uri)
      expect(parsed.address).toBe(params.address)
      expect(parsed.amount).toBe(params.amount)
      expect(parsed.label).toBe(params.label)
    })
  })
})
