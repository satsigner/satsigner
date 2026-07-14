import { javaSeededRandom } from '@/utils/crypto'

const JAVA_RANDOM_MULTIPLIER = 0x5deece66dn
const JAVA_RANDOM_ADDEND = 0xbn
const JAVA_RANDOM_MASK = (1n << 48n) - 1n

// Reference java.util.Random.nextInt(bound) using `| 0` to reproduce Java's
// signed 32-bit overflow in the rejection sampling condition exactly.
function javaReferenceRandom(seed: number) {
  let state = (BigInt(seed) ^ JAVA_RANDOM_MULTIPLIER) & JAVA_RANDOM_MASK

  function next(bits: number) {
    state =
      (state * JAVA_RANDOM_MULTIPLIER + JAVA_RANDOM_ADDEND) & JAVA_RANDOM_MASK
    return Number(state >> BigInt(48 - bits))
  }

  function nextInt(bound: number) {
    if ((bound & (bound - 1)) === 0) {
      return Number((BigInt(bound) * BigInt(next(31))) >> 31n)
    }

    let bits: number
    let val: number
    do {
      bits = next(31)
      val = bits % bound
    } while (((bits - val + (bound - 1)) | 0) < 0)

    return val
  }

  return { nextInt }
}

describe('javaSeededRandom', () => {
  const seeds = [0, 1, 42, 999, 2147483647]

  it('matches java.util.Random for small bounds', () => {
    for (const seed of seeds) {
      const actual = javaSeededRandom(seed)
      const expected = javaReferenceRandom(seed)
      for (let i = 0; i < 500; i += 1) {
        const bound = (i % 63) + 2
        expect(actual.nextInt(bound)).toBe(expected.nextInt(bound))
      }
    }
  })

  it('matches java.util.Random when rejection sampling triggers', () => {
    // With this bound ~33% of draws fall in the truncated tail of 2^31 and
    // must be rejected and redrawn, exercising the overflow condition.
    const bound = 1431655766

    for (const seed of seeds) {
      const actual = javaSeededRandom(seed)
      const expected = javaReferenceRandom(seed)
      for (let i = 0; i < 500; i += 1) {
        expect(actual.nextInt(bound)).toBe(expected.nextInt(bound))
      }
    }
  })

  it('matches java.util.Random for power-of-2 bounds', () => {
    for (const seed of seeds) {
      const actual = javaSeededRandom(seed)
      const expected = javaReferenceRandom(seed)
      for (const bound of [2, 8, 1024, 1073741824]) {
        for (let i = 0; i < 100; i += 1) {
          expect(actual.nextInt(bound)).toBe(expected.nextInt(bound))
        }
      }
    }
  })

  it('throws on non-positive bound', () => {
    const random = javaSeededRandom(42)
    expect(() => random.nextInt(0)).toThrow()
    expect(() => random.nextInt(-5)).toThrow()
  })
})
