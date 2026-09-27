import {
  formatAddress,
  formatDate,
  formatFeeRateSatPerVb,
  formatLargeNumber,
  formatNostrCardDate,
  formatNpub,
  formatNumber,
  formatShortPubkey,
  formatTime,
  formatTxId,
  truncate
} from '@/utils/format'

jest.mock<typeof import('@/locales')>('@/locales', () => ({
  i18n: { locale: 'en' },
  t: jest.fn((key: string) => {
    const words: Record<string, string> = {
      'numbers.billiard': 'billiard',
      'numbers.quadrillion': 'quadrillion',
      'numbers.trilliard': 'trilliard',
      'numbers.trillion': 'trillion'
    }
    return words[key] ?? key
  })
}))

describe('format utils', () => {
  describe('formatAddress', () => {
    const address = '1111111111111111111114oLvT2'

    it('should return an address with 16 or less characters', () => {
      expect(formatAddress('hi@satsigner.com')).toBe('hi@satsigner.com')
    })

    it('should keep 8 head and tail characters by default', () => {
      expect(formatAddress(address)).toBe('11111111...114oLvT2')
    })

    it('should use 6 characters for the default size', () => {
      expect(formatAddress(address, 'default')).toBe('111111...4oLvT2')
    })

    it('should use 4 characters for the compact size', () => {
      expect(formatAddress(address, 'compact')).toBe('1111...LvT2')
    })
  })

  describe('truncate', () => {
    it('should return the whole value when head + tail equals its length', () => {
      expect(truncate('abcdefghij', 6, 4)).toBe('abcdefghij')
    })

    it('should return the whole value when head + tail exceeds its length', () => {
      expect(truncate('abcdefghij', 8, 8)).toBe('abcdefghij')
    })

    it('should default the tail width to the head width', () => {
      expect(truncate('abcdefghijklmnop', 4)).toBe('abcd...mnop')
    })

    it('should not leak the whole value when tail is zero', () => {
      expect(truncate('abcdefghijklmnop', 4, 0)).toBe('abcd...')
    })
  })

  describe('formatNpub', () => {
    const npub = 'npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8'

    it('should keep 12 head and 4 tail characters by default', () => {
      expect(formatNpub(npub)).toBe('npub10elfcs4...dma8')
    })

    it('should middle-truncate symmetrically for a size', () => {
      expect(formatNpub(npub, 'xs')).toBe('npub10el...5mp4dma8')
    })
  })

  describe('formatNumber', () => {
    it('should return the correct localized number with no decimals', () => {
      expect(formatNumber(3000)).toBe('3,000')
      expect(formatNumber(1000000)).toBe('1,000,000')
    })

    it('should return the correct localized number with decimals', () => {
      expect(formatNumber(0.795, 2)).toBe('0.80')
    })
  })

  describe('formatFeeRateSatPerVb', () => {
    it('shows two decimals for sub-1 sat/vB rates', () => {
      expect(formatFeeRateSatPerVb(344 / 888)).toBe('0.39')
    })

    it('shows integers for whole rates', () => {
      expect(formatFeeRateSatPerVb(12)).toBe('12')
    })

    it('shows one decimal for fractional rates under 10', () => {
      expect(formatFeeRateSatPerVb(1.5)).toBe('1.5')
    })
  })

  describe('formatShortPubkey', () => {
    it('should return first five and last six characters for long hex', () => {
      expect(
        formatShortPubkey(
          '0248d0b103234567890abcdef0123456789abcdef0123456789abcdef23bf82'
        )
      ).toBe('0248d...23bf82')
    })

    it('should return the full string when it is short enough', () => {
      expect(formatShortPubkey('0248d')).toBe('0248d')
    })
  })

  describe('formatTime', () => {
    it('should return the correct formatted time', () => {
      expect(formatTime(new Date(1231006505000))).toBe('6:15pm')
    })
  })

  describe('formatNostrCardDate', () => {
    it('should return MMM DD, YYYY · time for a Nostr unix timestamp', () => {
      const localNoon = new Date(2026, 3, 15, 12, 0, 0)
      const unix = Math.floor(localNoon.getTime() / 1000)
      expect(formatNostrCardDate(unix)).toBe('Apr 15, 2026 · 12:00pm')
    })

    it('should return empty string for zero', () => {
      expect(formatNostrCardDate(0)).toBe('')
    })
  })

  describe('formatDate', () => {
    it('should return the correct formatted date', () => {
      expect(formatDate(new Date(1231006505000))).toBe('Jan 3, 2009')
    })

    it('should work with string date', () => {
      expect(formatDate('2024-03-28T11:51:36.000Z')).toBe('Mar 28, 2024')
    })

    it('should work with number date', () => {
      expect(formatDate(1711639918000)).toBe('Mar 28, 2024')
    })
  })

  describe('formatTxId', () => {
    const txid = '1111111111111111111114oLvT2'

    it('should return first and last six characters by default', () => {
      expect(formatTxId(txid)).toBe('111111...4oLvT2')
    })

    it('should use 3 characters for the tiny size', () => {
      expect(formatTxId(txid, 'tiny')).toBe('111...vT2')
    })

    it('should use 4 characters for the compact size', () => {
      expect(formatTxId(txid, 'compact')).toBe('1111...LvT2')
    })

    it('should use 8 characters for the wide size', () => {
      expect(formatTxId(txid, 'wide')).toBe('11111111...114oLvT2')
    })
  })

  describe('formatLargeNumber', () => {
    it('should return empty for zero, non-finite, and values under one thousand', () => {
      expect(formatLargeNumber(0)).toBe('')
      expect(formatLargeNumber(NaN)).toBe('')
      expect(formatLargeNumber(42)).toBe('')
      expect(formatLargeNumber(999)).toBe('')
    })

    it('should use Intl compact long for short-scale values', () => {
      expect(formatLargeNumber(1_000)).toBe('1 thousand')
      expect(formatLargeNumber(1_000_000)).toBe('1 million')
      expect(formatLargeNumber(30_000_000_000)).toBe('30 billion')
      expect(formatLargeNumber(1_500_000_000)).toBe('~2 billion')
    })

    it('should use i18n for quadrillion and above on short scale', () => {
      expect(formatLargeNumber(1e15)).toBe('1 quadrillion')
      expect(formatLargeNumber(2e15)).toBe('2 quadrillions')
      expect(formatLargeNumber(1.5e15)).toBe('~2 quadrillions')
    })

    it('should use European long-scale naming when european is true', () => {
      expect(formatLargeNumber(1e9, true)).toBe('1 milliard')
      expect(formatLargeNumber(1e12, true)).toBe('1 billion')
      expect(formatLargeNumber(1e15, true)).toBe('1 billiard')
      expect(formatLargeNumber(1e18, true)).toBe('1 trillion')
      expect(formatLargeNumber(1e21, true)).toBe('1 trilliard')
    })
  })
})
