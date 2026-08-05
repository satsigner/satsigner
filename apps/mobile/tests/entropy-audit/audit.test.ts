import { sampleSource, type EntropySourceName } from './sources'
import {
  bitBalance,
  CHI_SQUARE_255_P001,
  chiSquareBytes,
  collisionCount,
  serialCorrelation,
  uniqueBuffers
} from './stats'

/**
 * Use real node:crypto instead of the shared jest.fn-based mock: jest.fn
 * records every call's args and results, which retains gigabytes at
 * large-N collision sampling.
 */
jest.mock<{ __esModule: true; default: typeof import('node:crypto') }>(
  'react-native-quick-crypto',
  () => ({
    __esModule: true,
    default: jest.requireActual<typeof import('node:crypto')>('node:crypto')
  })
)

const SAMPLES = Number(process.env.ENTROPY_AUDIT_SAMPLES ?? 2000)
/**
 * Collisions among outputs with k bits of effective entropy appear with
 * probability ≈ 1 − e^(−N²/2^(k+1)). Distribution tests cannot see weak
 * input through SHA-256, so collisions are the only detector for
 * low-entropy-input bugs. 200k samples catch a 32-bit-seed class bug
 * (Trust Wallet 2023) with >99% probability; 5k would catch it ~0.3%.
 */
const COLLISION_SAMPLES = Number(
  process.env.ENTROPY_AUDIT_COLLISION_SAMPLES ?? 200_000
)
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
const COLLISION_FREE_SOURCES = new Set<EntropySourceName>([
  'csprng',
  'dice',
  'coin',
  'mix'
])

function collect(name: EntropySourceName, n = SAMPLES): Uint8Array[] {
  return Array.from({ length: n }, () => sampleSource(name, BYTE_COUNT))
}

/**
 * Streams samples so collision runs at large N without holding them all.
 *
 * @yields one conditioned sample
 */
function* stream(name: EntropySourceName, n: number): Generator<Uint8Array> {
  for (let i = 0; i < n; i += 1) {
    yield sampleSource(name, BYTE_COUNT)
  }
}

describe('entropy audit (large-N)', () => {
  jest.setTimeout(120_000)

  for (const source of HEALTHY_SOURCES) {
    describe(`source: ${source}`, () => {
      it('passes byte chi-square uniformity', () => {
        const buffers = uniqueBuffers(collect(source))
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
          expect(collisionCount(stream(source, COLLISION_SAMPLES))).toBe(0)
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

  describe('brokenLowEntropy canary', () => {
    it('produces collisions (32-bit-seed class bug)', () => {
      // ~19 expected duplicate pairs at 200k samples over a 30-bit seed space;
      // proves the collision test has power against this bug class at this N.
      const n = Math.max(COLLISION_SAMPLES, 200_000)
      expect(collisionCount(stream('brokenLowEntropy', n))).toBeGreaterThan(0)
    })
  })
})
