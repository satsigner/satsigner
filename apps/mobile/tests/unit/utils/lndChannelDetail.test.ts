import {
  getLndChannelPeerAlias,
  LIQUIDITY_BAR_PART_COUNT,
  liquidityBarSegmentFlexParts,
  parseLndSats
} from '@/utils/lndChannelDetail'

describe('lndChannelDetail', () => {
  describe('getLndChannelPeerAlias', () => {
    it('should read peerAlias from LND REST camelCase JSON', () => {
      expect(
        getLndChannelPeerAlias({
          peerAlias: 'Alice',
          remotePubkey: '02abc'
        })
      ).toBe('Alice')
    })

    it('should fall back to peer_alias snake_case', () => {
      expect(
        getLndChannelPeerAlias({
          peer_alias: 'Bob',
          remote_pubkey: '02def'
        })
      ).toBe('Bob')
    })
  })

  describe('liquidityBarSegmentFlexParts', () => {
    it('should give at least one part to tiny non-zero local balance', () => {
      expect(liquidityBarSegmentFlexParts(10_000_000, 1, 0)).toStrictEqual({
        black: LIQUIDITY_BAR_PART_COUNT - 1,
        local: 1,
        remote: 0
      })
    })

    it('should give at least one part to each side when both are non-zero', () => {
      const parts = liquidityBarSegmentFlexParts(10_000_000, 1, 1)
      expect(parts.local).toBeGreaterThanOrEqual(1)
      expect(parts.remote).toBeGreaterThanOrEqual(1)
      expect(parts.black).toBeGreaterThanOrEqual(0)
      expect(parts.local + parts.remote + parts.black).toBe(
        LIQUIDITY_BAR_PART_COUNT
      )
    })

    it('should return zeros when node total is zero', () => {
      expect(liquidityBarSegmentFlexParts(0, 100, 0)).toStrictEqual({
        black: 0,
        local: 0,
        remote: 0
      })
    })
  })

  describe('parseLndSats', () => {
    it('should parse non-negative integers', () => {
      expect(parseLndSats(1_500_000)).toBe(1_500_000)
    })

    it('should parse decimal string values from LND JSON', () => {
      expect(parseLndSats('2500000')).toBe(2_500_000)
    })

    it('should trim string input', () => {
      expect(parseLndSats('  100  ')).toBe(100)
    })

    it('should return 0 for invalid or empty input', () => {
      expect(parseLndSats('')).toBe(0)
      expect(parseLndSats('x')).toBe(0)
      expect(parseLndSats(undefined)).toBe(0)
      expect(parseLndSats(NaN)).toBe(0)
    })
  })
})
