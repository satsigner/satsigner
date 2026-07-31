import { randomIv, randomKey, randomNum, randomUuid } from '@/utils/crypto'
import { getConfirmWordCandidates } from '@/utils/seed'

const englishMnemonic =
  'visa toddler sentence rival twin believe report person library security stadium hurt'

const MAX_UINT32_DRAW = 0xffffffff

/**
 * Forces the next `count` draws to the maximal uint32, then falls back to real
 * randomness. A permanently pinned generator would hang any caller that
 * rejection-samples or loops until it collects distinct values.
 */
function mockMaximalDraws(count: number) {
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
  let remaining = count

  return jest
    .spyOn(globalThis.crypto, 'getRandomValues')
    .mockImplementation((array) => {
      if (remaining > 0 && array instanceof Uint32Array) {
        remaining -= 1
        array[0] = MAX_UINT32_DRAW
        return array
      }
      return real(array as Uint32Array)
    })
}

describe('randomNum', () => {
  it('stays within [0, 1)', () => {
    for (let i = 0; i < 20_000; i += 1) {
      const value = randomNum()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  // Regression: dividing by 2^32-1 let a maximal draw return exactly 1.0,
  // which pushed Math.floor(randomNum() * n) one index past the end.
  it('never returns exactly 1', () => {
    const spy = mockMaximalDraws(1)
    try {
      expect(randomNum()).toBeLessThan(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('cannot index past the end of an array on a maximal draw', () => {
    const spy = mockMaximalDraws(1)
    try {
      const items = ['a', 'b', 'c']
      expect(items[Math.floor(randomNum() * items.length)]).toBeDefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('returns 0 on a minimal draw', () => {
    const spy = jest
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation((array) => {
        ;(array as Uint32Array)[0] = 0
        return array
      })

    try {
      expect(randomNum()).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })

  it('spreads values across the unit interval', () => {
    const buckets = Array.from({ length: 10 }, () => 0)
    const draws = 40_000
    for (let i = 0; i < draws; i += 1) {
      buckets[Math.floor(randomNum() * 10)] += 1
    }
    for (const count of buckets) {
      expect(count / draws).toBeGreaterThan(0.08)
      expect(count / draws).toBeLessThan(0.12)
    }
  })

  it('does not repeat consecutive values', () => {
    const values = new Set<number>()
    for (let i = 0; i < 1000; i += 1) {
      values.add(randomNum())
    }
    expect(values.size).toBeGreaterThan(990)
  })
})

describe('randomIv', () => {
  it('returns 32 hex characters (16 bytes)', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(randomIv()).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  // Regression: the IV was derived from uuid.v4(), which fixes 6 bits at known
  // positions (version nibble '4' and the two variant bits).
  it('does not pin the UUID version nibble', () => {
    const nibbles = new Set<string>()
    for (let i = 0; i < 500; i += 1) {
      nibbles.add(randomIv()[12])
    }
    expect(nibbles.size).toBeGreaterThan(8)
  })

  it('does not pin the UUID variant bits', () => {
    const nibbles = new Set<string>()
    for (let i = 0; i < 500; i += 1) {
      nibbles.add(randomIv()[16])
    }
    expect(nibbles.size).toBeGreaterThan(8)
  })

  it('uses the full 16 bytes of entropy', () => {
    const perPosition = Array.from({ length: 32 }, () => new Set<string>())
    for (let i = 0; i < 500; i += 1) {
      const iv = randomIv()
      for (let position = 0; position < 32; position += 1) {
        perPosition[position].add(iv[position])
      }
    }
    for (const seen of perPosition) {
      expect(seen.size).toBeGreaterThan(8)
    }
  })

  it('is unique across calls', () => {
    const ivs = new Set<string>()
    for (let i = 0; i < 1000; i += 1) {
      ivs.add(randomIv())
    }
    expect(ivs.size).toBe(1000)
  })
})

describe('randomKey', () => {
  it('returns the requested byte length as hex', async () => {
    await expect(randomKey(16)).resolves.toMatch(/^[0-9a-f]{32}$/)
    await expect(randomKey(32)).resolves.toMatch(/^[0-9a-f]{64}$/)
  })

  it('defaults to 16 bytes', async () => {
    await expect(randomKey()).resolves.toHaveLength(32)
  })

  it('is unique across calls', async () => {
    const keys = await Promise.all(
      Array.from({ length: 200 }, () => randomKey(32))
    )
    expect(new Set(keys).size).toBe(200)
  })
})

describe('randomUuid', () => {
  it('returns a v4 UUID', () => {
    expect(randomUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it('is unique across calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i += 1) {
      ids.add(randomUuid())
    }
    expect(ids.size).toBe(1000)
  })
})

describe('getConfirmWordCandidates', () => {
  it('returns three candidates including the target word', () => {
    const candidates = getConfirmWordCandidates('visa', englishMnemonic)
    expect(candidates).toHaveLength(3)
    expect(candidates).toContain('visa')
  })

  // Regression: randomNum() returning exactly 1.0 produced an undefined
  // candidate, rendering a blank option on the seed confirmation screen.
  it('never yields an undefined candidate on a maximal draw', () => {
    const spy = mockMaximalDraws(1)
    try {
      const candidates = getConfirmWordCandidates('visa', englishMnemonic)
      expect(candidates).toHaveLength(3)
      for (const candidate of candidates) {
        expect(candidate).toBeDefined()
        expect(typeof candidate).toBe('string')
      }
    } finally {
      spy.mockRestore()
    }
  })

  it('never yields duplicates or undefined across many runs', () => {
    for (let i = 0; i < 500; i += 1) {
      const candidates = getConfirmWordCandidates('visa', englishMnemonic)
      expect(candidates).toHaveLength(3)
      expect(new Set(candidates).size).toBe(3)
      for (const candidate of candidates) {
        expect(candidate).toBeDefined()
      }
    }
  })

  it('draws candidates only from the mnemonic', () => {
    const words = new Set(englishMnemonic.split(' '))
    for (let i = 0; i < 200; i += 1) {
      for (const candidate of getConfirmWordCandidates(
        'visa',
        englishMnemonic
      )) {
        expect(words.has(candidate)).toBe(true)
      }
    }
  })

  it('places the target word in varying positions', () => {
    const positions = new Set<number>()
    for (let i = 0; i < 300; i += 1) {
      positions.add(
        getConfirmWordCandidates('visa', englishMnemonic).indexOf('visa')
      )
    }
    expect(positions.size).toBeGreaterThan(1)
  })

  it('degrades gracefully for an empty current word', () => {
    expect(getConfirmWordCandidates('', englishMnemonic)).toStrictEqual([
      '',
      '',
      ''
    ])
  })

  it('degrades gracefully when the mnemonic has too few unique words', () => {
    const candidates = getConfirmWordCandidates('abandon', 'abandon abandon')
    expect(candidates).toHaveLength(3)
    expect(candidates[0]).toBe('abandon')
  })
})
