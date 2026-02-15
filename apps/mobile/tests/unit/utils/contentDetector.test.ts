import {
  detectContentByContext,
  getContentTypeDescription,
  isContentTypeSupportedInContext
} from '@/utils/contentDetector'

import {
  addresses,
  bip321Uris,
  bolt12Offers,
  cashuTokens,
  lightningInvoices,
  lnurls
} from './bip321_samples'

describe('contentDetector', () => {
  describe('detectContentByContext - Bitcoin context', () => {
    describe('Bitcoin addresses', () => {
      it('should detect mainnet P2WPKH address', async () => {
        const result = await detectContentByContext(
          addresses.mainnet.p2wpkh,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_address')
        expect(result.isValid).toBe(true)
      })

      it('should detect mainnet P2PKH address', async () => {
        const result = await detectContentByContext(
          addresses.mainnet.p2pkh,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_address')
        expect(result.isValid).toBe(true)
      })

      it('should detect mainnet P2SH address', async () => {
        const result = await detectContentByContext(
          addresses.mainnet.p2sh,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_address')
        expect(result.isValid).toBe(true)
      })

      it('should detect testnet P2WPKH address', async () => {
        const result = await detectContentByContext(
          addresses.testnet.p2wpkh,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_address')
        expect(result.isValid).toBe(true)
      })

      it('should detect regtest address', async () => {
        const result = await detectContentByContext(
          addresses.regtest.p2wpkh,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_address')
        expect(result.isValid).toBe(true)
      })
    })

    describe('BIP-321 URIs', () => {
      it('should detect basic BIP-321 URI', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.addressOnly,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_uri')
        expect(result.isValid).toBe(true)
      })

      it('should detect BIP-321 URI with amount', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.withAmount,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_uri')
        expect(result.isValid).toBe(true)
      })

      it('should detect BIP-321 URI with label', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.withLabel,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_uri')
        expect(result.isValid).toBe(true)
      })

      it('should detect uppercase scheme BIP-321 URI', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.uppercaseScheme,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_uri')
        expect(result.isValid).toBe(true)
      })

      it('should detect testnet BIP-321 URI', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.testnet,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_uri')
        expect(result.isValid).toBe(true)
      })

      it('should detect regtest BIP-321 URI', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.regtest,
          'bitcoin'
        )
        expect(result.type).toBe('bitcoin_uri')
        expect(result.isValid).toBe(true)
      })
    })

    describe('incompatible content in Bitcoin context', () => {
      it('should mark Lightning invoice as incompatible', async () => {
        const result = await detectContentByContext(
          lightningInvoices.mainnet.basic,
          'bitcoin'
        )
        expect(result.type).toBe('incompatible')
      })

      it('should mark ecash token as incompatible', async () => {
        const result = await detectContentByContext(
          cashuTokens.valid.v3,
          'bitcoin'
        )
        expect(result.type).toBe('incompatible')
      })
    })
  })

  describe('detectContentByContext - Lightning context', () => {
    describe('BOLT11 invoices by network', () => {
      it('should detect mainnet invoice (lnbc)', async () => {
        const result = await detectContentByContext(
          lightningInvoices.mainnet.basic,
          'lightning'
        )
        expect(result.type).toBe('lightning_invoice')
        expect(result.isValid).toBe(true)
      })

      it('should detect testnet invoice (lntb)', async () => {
        const result = await detectContentByContext(
          lightningInvoices.testnet.basic,
          'lightning'
        )
        expect(result.type).toBe('lightning_invoice')
        expect(result.isValid).toBe(true)
      })

      it('should detect regtest invoice (lnbcrt)', async () => {
        const result = await detectContentByContext(
          lightningInvoices.regtest.basic,
          'lightning'
        )
        expect(result.type).toBe('lightning_invoice')
        expect(result.isValid).toBe(true)
      })

      it('should detect signet invoice (lntbs)', async () => {
        const result = await detectContentByContext(
          lightningInvoices.signet.basic,
          'lightning'
        )
        expect(result.type).toBe('lightning_invoice')
        expect(result.isValid).toBe(true)
      })

      it('should include network in metadata for mainnet', async () => {
        const result = await detectContentByContext(
          lightningInvoices.mainnet.basic,
          'lightning'
        )
        expect(result.metadata?.network).toBe('bitcoin')
      })

      it('should include network in metadata for testnet', async () => {
        const result = await detectContentByContext(
          lightningInvoices.testnet.basic,
          'lightning'
        )
        expect(result.metadata?.network).toBe('testnet')
      })

      it('should include network in metadata for signet', async () => {
        const result = await detectContentByContext(
          lightningInvoices.signet.basic,
          'lightning'
        )
        expect(result.metadata?.network).toBe('signet')
      })
    })

    describe('BOLT12 offers', () => {
      it('should detect BOLT12 offer (lno)', async () => {
        const result = await detectContentByContext(
          bolt12Offers.valid.basic,
          'lightning'
        )
        expect(result.type).toBe('lightning_invoice')
        expect(result.metadata?.isBolt12).toBe(true)
        expect(result.isValid).toBe(true)
      })

      it('should reject invalid BOLT12 offer', async () => {
        const result = await detectContentByContext(
          bolt12Offers.invalid.tooShort,
          'lightning'
        )
        expect(result.type).toBe('lightning_invoice')
        expect(result.metadata?.isBolt12).toBe(true)
        expect(result.isValid).toBe(false)
      })
    })

    describe('LNURL', () => {
      it('should detect LNURL pay', async () => {
        const result = await detectContentByContext(
          lnurls.valid.pay,
          'lightning'
        )
        expect(result.type).toBe('lnurl')
        expect(result.isValid).toBe(true)
      })

      it('should detect LNURL withdraw', async () => {
        const result = await detectContentByContext(
          lnurls.valid.withdraw,
          'lightning'
        )
        expect(result.type).toBe('lnurl')
        expect(result.isValid).toBe(true)
      })
    })

    describe('incompatible content in Lightning context', () => {
      it('should mark Bitcoin address as incompatible', async () => {
        const result = await detectContentByContext(
          addresses.mainnet.p2wpkh,
          'lightning'
        )
        expect(result.type).toBe('incompatible')
      })

      it('should mark BIP-321 URI as incompatible', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.withAmount,
          'lightning'
        )
        expect(result.type).toBe('incompatible')
      })
    })
  })

  describe('detectContentByContext - Ecash context', () => {
    describe('Cashu tokens', () => {
      it('should detect v3 Cashu token', async () => {
        const result = await detectContentByContext(
          cashuTokens.valid.v3,
          'ecash'
        )
        expect(result.type).toBe('ecash_token')
        expect(result.isValid).toBe(true)
        expect(result.metadata?.version).toBe('v3')
      })

      it('should detect v4 Cashu token', async () => {
        const result = await detectContentByContext(
          cashuTokens.valid.v4,
          'ecash'
        )
        expect(result.type).toBe('ecash_token')
        expect(result.isValid).toBe(true)
        expect(result.metadata?.version).toBe('v4')
      })
    })

    describe('Lightning in ecash context', () => {
      it('should allow Lightning invoice in ecash context', async () => {
        const result = await detectContentByContext(
          lightningInvoices.mainnet.basic,
          'ecash'
        )
        expect(result.type).toBe('lightning_invoice')
        expect(result.isValid).toBe(true)
      })

      it('should allow LNURL in ecash context', async () => {
        const result = await detectContentByContext(lnurls.valid.pay, 'ecash')
        expect(result.type).toBe('lnurl')
        expect(result.isValid).toBe(true)
      })
    })

    describe('incompatible content in Ecash context', () => {
      it('should mark Bitcoin address as incompatible', async () => {
        const result = await detectContentByContext(
          addresses.mainnet.p2wpkh,
          'ecash'
        )
        expect(result.type).toBe('incompatible')
      })

      it('should mark BIP-321 URI as incompatible', async () => {
        const result = await detectContentByContext(
          bip321Uris.valid.withAmount,
          'ecash'
        )
        expect(result.type).toBe('incompatible')
      })
    })
  })

  describe('detectContentByContext - edge cases', () => {
    it('should return unknown for empty string', async () => {
      const result = await detectContentByContext('', 'bitcoin')
      expect(result.type).toBe('unknown')
      expect(result.isValid).toBe(false)
    })

    it('should return unknown for whitespace only', async () => {
      const result = await detectContentByContext('   ', 'bitcoin')
      expect(result.type).toBe('unknown')
      expect(result.isValid).toBe(false)
    })

    it('should return unknown for random text', async () => {
      const result = await detectContentByContext(
        'random text that is not valid',
        'bitcoin'
      )
      expect(result.type).toBe('unknown')
      expect(result.isValid).toBe(false)
    })
  })

  describe('isContentTypeSupportedInContext', () => {
    describe('Bitcoin context', () => {
      it('should support bitcoin_address', () => {
        expect(
          isContentTypeSupportedInContext('bitcoin_address', 'bitcoin')
        ).toBe(true)
      })

      it('should support bitcoin_uri', () => {
        expect(isContentTypeSupportedInContext('bitcoin_uri', 'bitcoin')).toBe(
          true
        )
      })

      it('should support psbt', () => {
        expect(isContentTypeSupportedInContext('psbt', 'bitcoin')).toBe(true)
      })

      it('should not support lightning_invoice', () => {
        expect(
          isContentTypeSupportedInContext('lightning_invoice', 'bitcoin')
        ).toBe(false)
      })

      it('should not support ecash_token', () => {
        expect(isContentTypeSupportedInContext('ecash_token', 'bitcoin')).toBe(
          false
        )
      })
    })

    describe('Lightning context', () => {
      it('should support lightning_invoice', () => {
        expect(
          isContentTypeSupportedInContext('lightning_invoice', 'lightning')
        ).toBe(true)
      })

      it('should support lnurl', () => {
        expect(isContentTypeSupportedInContext('lnurl', 'lightning')).toBe(true)
      })

      it('should not support bitcoin_address', () => {
        expect(
          isContentTypeSupportedInContext('bitcoin_address', 'lightning')
        ).toBe(false)
      })
    })

    describe('Ecash context', () => {
      it('should support ecash_token', () => {
        expect(isContentTypeSupportedInContext('ecash_token', 'ecash')).toBe(
          true
        )
      })

      it('should support lightning_invoice', () => {
        expect(
          isContentTypeSupportedInContext('lightning_invoice', 'ecash')
        ).toBe(true)
      })

      it('should support lnurl', () => {
        expect(isContentTypeSupportedInContext('lnurl', 'ecash')).toBe(true)
      })

      it('should not support bitcoin_address', () => {
        expect(
          isContentTypeSupportedInContext('bitcoin_address', 'ecash')
        ).toBe(false)
      })
    })
  })

  describe('getContentTypeDescription', () => {
    it('should return correct description for bitcoin_address', () => {
      expect(getContentTypeDescription('bitcoin_address')).toBe(
        'Bitcoin Address'
      )
    })

    it('should return correct description for bitcoin_uri', () => {
      expect(getContentTypeDescription('bitcoin_uri')).toBe(
        'Bitcoin Payment Request'
      )
    })

    it('should return correct description for lightning_invoice', () => {
      expect(getContentTypeDescription('lightning_invoice')).toBe(
        'Lightning Network Invoice'
      )
    })

    it('should return correct description for ecash_token', () => {
      expect(getContentTypeDescription('ecash_token')).toBe('Ecash Token')
    })

    it('should return correct description for lnurl', () => {
      expect(getContentTypeDescription('lnurl')).toBe('LNURL Payment Request')
    })

    it('should return correct description for unknown', () => {
      expect(getContentTypeDescription('unknown')).toBe('Unknown Content')
    })
  })
})
