import { sampleSource, type EntropySourceName } from './sources'
import {
  bitBalance,
  CHI_SQUARE_255_P001,
  chiSquareBytes,
  collisionCount,
  serialCorrelation
} from './stats'

const SAMPLES = Number(process.env.ENTROPY_AUDIT_SAMPLES ?? 2000)
const BYTE_COUNT = 16

const HEALTHY_SOURCES: EntropySourceName[] = [
  'csprng',
  'dice',
  'diceBiased',
  'coin',
  'coinBiased',
  'mix'
]

/** Biased generators often repeat identical input logs; collisions there are expected. */
const COLLISION_FREE_SOURCES: EntropySourceName[] = new Set([
  'csprng',
  'dice',
  'coin',
  'mix'
])

function collect(name: EntropySourceName, n = SAMPLES): Uint8Array[] {
  return Array.from({ length: n }, () => sampleSource(name, BYTE_COUNT))
}

describe('entropy audit (large-N)', () => {
  jest.setTimeout(120_000)

  for (const source of HEALTHY_SOURCES) {
    describe(`source: ${source}`, () => {
      it('passes byte chi-square uniformity', () => {
        const buffers = collect(source)
        expect(chiSquareBytes(buffers)).toBeLessThan(CHI_SQUARE_255_P001)
      })

      it('keeps bit balance near 0.5', () => {
        const balance = bitBalance(collect(source))
        expect(balance).toBeGreaterThan(0.48)
        expect(balance).toBeLessThan(0.52)
      })

      it('has near-zero serial correlation', () => {
        expect(Math.abs(serialCorrelation(collect(source)))).toBeLessThan(0.02)
      })

      if (COLLISION_FREE_SOURCES.has(source)) {
        it('produces no collisions among samples', () => {
          expect(collisionCount(collect(source))).toBe(0)
        })
      }
    })
  }

  describe('brokenRestricted canary', () => {
    it('fails byte chi-square (Coldcard-class restricted alphabet)', () => {
      const buffers = collect('brokenRestricted', Math.max(SAMPLES, 5000))
      expect(chiSquareBytes(buffers)).toBeGreaterThan(CHI_SQUARE_255_P001)
    })
  })
})
