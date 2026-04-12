import {
  parseDescriptor,
  parseLabel,
  parseLabelTags,
  parseUriParameters,
  stripBitcoinPrefix
} from '@/utils/parse'

describe('parse utils', () => {
  describe('stripBitcoinPrefix', () => {
    it('should strip lowercase bitcoin: prefix', () => {
      expect(stripBitcoinPrefix('bitcoin:abc123')).toBe('abc123')
    })

    it('should strip uppercase BITCOIN: prefix', () => {
      expect(stripBitcoinPrefix('BITCOIN:abc123')).toBe('abc123')
    })

    it('should strip mixed case Bitcoin: prefix', () => {
      expect(stripBitcoinPrefix('Bitcoin:abc123')).toBe('abc123')
    })

    it('should return original string if no prefix', () => {
      expect(stripBitcoinPrefix('abc123')).toBe('abc123')
    })

    it('should handle empty string', () => {
      expect(stripBitcoinPrefix('')).toBe('')
    })

    it('should handle address with query params', () => {
      expect(stripBitcoinPrefix('bitcoin:abc123?amount=1.5')).toBe(
        'abc123?amount=1.5'
      )
    })
  })

  describe('parseUriParameters', () => {
    it('should parse address without parameters', () => {
      const result = parseUriParameters('bc1qtest123')
      expect(result).toStrictEqual({ address: 'bc1qtest123' })
    })

    it('should parse address with amount', () => {
      const result = parseUriParameters('bc1qtest123?amount=1.5')
      expect(result).toStrictEqual({
        address: 'bc1qtest123',
        amount: 1.5,
        label: undefined
      })
    })

    it('should parse address with label', () => {
      const result = parseUriParameters('bc1qtest123?label=Test%20Payment')
      expect(result).toStrictEqual({
        address: 'bc1qtest123',
        amount: undefined,
        label: 'Test Payment'
      })
    })

    it('should parse address with amount and label', () => {
      const result = parseUriParameters('bc1qtest123?amount=0.001&label=Coffee')
      expect(result).toStrictEqual({
        address: 'bc1qtest123',
        amount: 0.001,
        label: 'Coffee'
      })
    })

    it('should return null for empty string', () => {
      const result = parseUriParameters('')
      expect(result).toBeNull()
    })

    it('should handle address with empty query string', () => {
      const result = parseUriParameters('bc1qtest123?')
      expect(result).toStrictEqual({
        address: 'bc1qtest123',
        amount: undefined,
        label: undefined
      })
    })
  })

  describe('parseLabel', () => {
    it('should return label with no tags', () => {
      const result = parseLabel('Test label')
      expect(result.label).toBe('Test label')
      expect(result.tags).toHaveLength(0)
    })

    it('should return label with tags', () => {
      const result = parseLabel('Test label #kyc #satsigner')
      expect(result.label).toBe('Test label')
      expect(result.tags).toStrictEqual(['kyc', 'satsigner'])
    })
  })

  describe('parseLabelTags', () => {
    it('should return only label', () => {
      const result = parseLabelTags('My label', [])
      expect(result).toBe('My label')
    })

    it('should return label and tags', () => {
      const result = parseLabelTags('My label', ['endthefed', 'nokyc'])
      expect(result).toBe('My label #endthefed #nokyc')
    })

    it('should return only tags', () => {
      const result = parseLabelTags('', ['endthefed', 'nokyc'])
      expect(result).toBe('#endthefed #nokyc')
    })
  })

  describe('parseDescriptor', () => {
    it('extracts mainnet xpub from wpkh descriptor', () => {
      const d =
        "wpkh([d34db33f/84'/0'/0']xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG/0/*)#jfve3kwe"
      const { xpubs } = parseDescriptor(d)
      expect(xpubs).toStrictEqual([
        'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWZiD6gkqamhVgBkt3Y5MpcMbTexKCNc5shV4zrtJzeYp5G5ayUCsKcxV4kVFCYiyCMJNWv4sh2XycHBG'
      ])
    })

    it('extracts tpub when the prefix uses uppercase letters', () => {
      const lower =
        "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#113CZT8y"
      const upper = lower.replace('tpub', 'TPUB')
      expect(parseDescriptor(upper).xpubs[0].toLowerCase()).toBe(
        parseDescriptor(lower).xpubs[0].toLowerCase()
      )
    })

    it('treats external multipath and /0/* as same xpub material', () => {
      const multipath =
        "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/<0;1>/*)#3qsy06cj"
      const external =
        "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#113CZT8y"
      expect(parseDescriptor(multipath)).toStrictEqual(
        parseDescriptor(external)
      )
    })

    it('detects sortedmulti multisig case-insensitively (wsh)', () => {
      const lower =
        "wsh(sortedmulti(2,[73c5da0a/48'/1'/0'/2']tpubDFH9dgzveyD8zTbPUFuLrGmCydNvxehyNdUXKJAQN8x4aZ4j6UZqGfnqFrD4NqyaTVGKbvEW54tsvPTK2UoSbCC1PJY8iCNiwTL3RWZEheQ/0/*,[f57a6b99/48'/1'/0'/2']tpubDE8wPPUAhLGBvb4M3RjkhcPpGqQDcsnpQto4Wv5J8PUnLwiYijav8fqPCvumR4YPLF8QYWN4cJhPGa5emobn3bgLZ2LnQ3LBhDJKBhibTv6/0/*))#cflzs9pc"
      const upper = lower.replace('wsh(sortedmulti', 'Wsh(SortedMulti')
      expect(parseDescriptor(upper).xpubs.toSorted()).toStrictEqual(
        parseDescriptor(lower).xpubs.toSorted()
      )
    })
  })
})
