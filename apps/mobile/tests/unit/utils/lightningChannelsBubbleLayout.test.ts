import {
  buildLightningChannelsBubbleLayout,
  scaleBubbleRadius
} from '@/utils/lightningChannelsBubbleLayout'

describe('lightningChannelsBubbleLayout', () => {
  describe('scaleBubbleRadius', () => {
    it('returns min when value or max is zero', () => {
      expect(scaleBubbleRadius(0, 100, 3, 20)).toBe(3)
      expect(scaleBubbleRadius(50, 0, 3, 20)).toBe(3)
    })

    it('returns max when value equals max', () => {
      expect(scaleBubbleRadius(100, 100, 3, 20)).toBe(20)
    })

    it('scales sublinearly between min and max', () => {
      const mid = scaleBubbleRadius(25, 100, 3, 20)
      expect(mid).toBeGreaterThan(3)
      expect(mid).toBeLessThan(20)
    })
  })

  describe('buildLightningChannelsBubbleLayout', () => {
    it('returns null for empty rows', () => {
      expect(buildLightningChannelsBubbleLayout([], 320, 320)).toBeNull()
    })

    it('sums inbound as remote and outbound as local', () => {
      const layout = buildLightningChannelsBubbleLayout(
        [
          { chanId: '1', localSats: 100, peerLabel: 'A', remoteSats: 50 },
          { chanId: '2', localSats: 200, peerLabel: 'B', remoteSats: 10 }
        ],
        320,
        320
      )
      expect(layout).not.toBeNull()
      expect(layout?.hub.totalOutboundSats).toBe(300)
      expect(layout?.hub.totalInboundSats).toBe(60)
    })

    it('places one channel upward from hub center', () => {
      const layout = buildLightningChannelsBubbleLayout(
        [
          {
            chanId: 'x',
            localSats: 1_000_000,
            peerLabel: 'P',
            remoteSats: 500_000
          }
        ],
        400,
        400
      )
      expect(layout?.channels).toHaveLength(1)
      const ch = layout?.channels[0]
      expect(ch?.ux).toBeCloseTo(0, 5)
      expect(ch?.uy).toBeLessThan(0)
      expect(ch?.local.cy).toBeLessThan(layout?.hub.cy ?? 0)
    })

    it('keeps remote circle further from hub than local', () => {
      const layout = buildLightningChannelsBubbleLayout(
        [
          {
            chanId: 'x',
            localSats: 100_000,
            peerLabel: 'P',
            remoteSats: 100_000
          }
        ],
        400,
        400
      )
      const ch = layout?.channels[0]
      const distLocal = Math.hypot(
        (ch?.local.cx ?? 0) - (layout?.hub.cx ?? 0),
        (ch?.local.cy ?? 0) - (layout?.hub.cy ?? 0)
      )
      const distRemote = Math.hypot(
        (ch?.remote.cx ?? 0) - (layout?.hub.cx ?? 0),
        (ch?.remote.cy ?? 0) - (layout?.hub.cy ?? 0)
      )
      expect(distRemote).toBeGreaterThan(distLocal)
    })
  })
})
