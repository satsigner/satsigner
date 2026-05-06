import {
  blockSubsidySats,
  blocksUntilDifficultyAdjustment,
  blocksUntilHalving,
  difficultyEpoch,
  halvingEpoch,
  HALVING_INTERVAL,
  historicalHalvings,
  INITIAL_SUBSIDY_SATS,
  nextHalvingHeight,
  percentIssued,
  totalMinedSats
} from '@/utils/bitcoin/consensus'

describe('consensus utils', () => {
  describe('halvingEpoch', () => {
    it('returns 0 for genesis block', () => {
      expect(halvingEpoch(0)).toBe(0)
    })

    it('returns 0 just before first halving', () => {
      expect(halvingEpoch(209_999)).toBe(0)
    })

    it('returns 1 at first halving block', () => {
      expect(halvingEpoch(210_000)).toBe(1)
    })

    it('returns 4 at fourth halving (2024)', () => {
      expect(halvingEpoch(840_000)).toBe(4)
    })
  })

  describe('blockSubsidySats', () => {
    it('returns 50 BTC at genesis', () => {
      expect(blockSubsidySats(0)).toBe(50 * 100_000_000)
    })

    it('returns 25 BTC after first halving', () => {
      expect(blockSubsidySats(210_000)).toBe(25 * 100_000_000)
    })

    it('returns 12.5 BTC after second halving', () => {
      expect(blockSubsidySats(420_000)).toBe(12.5 * 100_000_000)
    })

    it('returns 3.125 BTC after fourth halving', () => {
      expect(blockSubsidySats(840_000)).toBe(3.125 * 100_000_000)
    })
  })

  describe('nextHalvingHeight', () => {
    it('returns 210000 from genesis', () => {
      expect(nextHalvingHeight(0)).toBe(210_000)
    })

    it('returns 420000 from block 210000', () => {
      expect(nextHalvingHeight(210_000)).toBe(420_000)
    })

    it('returns correct height from mid-epoch block', () => {
      expect(nextHalvingHeight(300_000)).toBe(420_000)
    })
  })

  describe('blocksUntilHalving', () => {
    it('returns 210000 blocks from genesis', () => {
      expect(blocksUntilHalving(0)).toBe(210_000)
    })

    it('returns 1 at block before halving', () => {
      expect(blocksUntilHalving(209_999)).toBe(1)
    })

    it('returns 210000 at exact halving block', () => {
      expect(blocksUntilHalving(210_000)).toBe(210_000)
    })
  })

  describe('totalMinedSats', () => {
    it('includes genesis block subsidy', () => {
      expect(totalMinedSats(0)).toBe(INITIAL_SUBSIDY_SATS)
    })

    it('matches known total at end of first epoch', () => {
      const expected = INITIAL_SUBSIDY_SATS * HALVING_INTERVAL
      expect(totalMinedSats(209_999)).toBe(expected)
    })

    it('does not exceed max supply', () => {
      const maxHeight = 6_930_000
      expect(totalMinedSats(maxHeight)).toBeLessThanOrEqual(
        21_000_000 * 100_000_000
      )
    })
  })

  describe('percentIssued', () => {
    it('is greater than 0 at genesis', () => {
      expect(percentIssued(0)).toBeGreaterThan(0)
    })

    it('is less than 100 at current heights', () => {
      expect(percentIssued(900_000)).toBeLessThan(100)
    })

    it('is around 93.75% after 4th halving start', () => {
      expect(percentIssued(840_000)).toBeCloseTo(93.75, 0)
    })
  })

  describe('difficultyEpoch', () => {
    it('returns 0 at genesis', () => {
      expect(difficultyEpoch(0)).toBe(0)
    })

    it('returns 1 at block 2016', () => {
      expect(difficultyEpoch(2016)).toBe(1)
    })

    it('returns 0 just before first adjustment', () => {
      expect(difficultyEpoch(2015)).toBe(0)
    })
  })

  describe('blocksUntilDifficultyAdjustment', () => {
    it('returns 2016 at genesis', () => {
      expect(blocksUntilDifficultyAdjustment(0)).toBe(2016)
    })

    it('returns 1 one block before adjustment', () => {
      expect(blocksUntilDifficultyAdjustment(2015)).toBe(1)
    })

    it('returns 2016 exactly at adjustment boundary', () => {
      expect(blocksUntilDifficultyAdjustment(2016)).toBe(2016)
    })
  })

  describe('historicalHalvings', () => {
    it('first entry is genesis with 50 BTC', () => {
      const halvings = historicalHalvings()
      expect(halvings[0].epoch).toBe(0)
      expect(halvings[0].height).toBe(0)
      expect(halvings[0].subsidySats).toBe(50 * 100_000_000)
    })

    it('includes 33 halvings before subsidy drops to 0', () => {
      const halvings = historicalHalvings()
      expect(halvings).toHaveLength(33)
    })

    it('last entry has 1 sat subsidy', () => {
      const halvings = historicalHalvings()
      expect(halvings.at(-1).subsidySats).toBe(1)
    })
  })
})
