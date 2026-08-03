import {
  entropyBitsForWordCount,
  entropyFromCoinFlips,
  entropyFromDiceRolls,
  isSequenceBiased,
  isSequencePatterned,
  isSequenceWeak,
  mixWithSystemEntropy,
  observedEntropyRate,
  randomCoinFlip,
  randomDiceRoll,
  randomIndex,
  requiredCoinFlips,
  requiredDiceRolls
} from '@/utils/entropy'

const PARTIAL = { allowPartial: true } as const

/** Frozen vectors: SHA-512("domain:input") truncated to bits/8 bytes as bits. */
const DICE_KAT_128 =
  '11111100110000101110001101010111000000011110000111001110110000010111000110001000110100110000110111111000111011100000111101110110'
const COIN_KAT_128 =
  '10111100110011010110000000111001010111100100000000100101110100110111000101000010101111011101111000001000110000110000101001011010'

const WORD_COUNTS = [12, 15, 18, 21, 24] as const

function shannonEntropy(counts: Map<string, number>, total: number): number {
  let h = 0
  for (const count of counts.values()) {
    const p = count / total
    h -= p * Math.log2(p)
  }
  return h
}

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function rollsFor(bits: number, generator: () => number): number[] {
  return Array.from({ length: requiredDiceRolls(bits) }, generator)
}

describe('entropyBitsForWordCount', () => {
  it('maps BIP39 word counts to their entropy widths', () => {
    expect(entropyBitsForWordCount(12)).toBe(128)
    expect(entropyBitsForWordCount(15)).toBe(160)
    expect(entropyBitsForWordCount(18)).toBe(192)
    expect(entropyBitsForWordCount(21)).toBe(224)
    expect(entropyBitsForWordCount(24)).toBe(256)
  })

  it('always yields a whole number of bytes divisible by 32', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      expect(bits % 32).toBe(0)
      expect(bits % 8).toBe(0)
    }
  })
})

describe('requiredDiceRolls', () => {
  it('covers the requested entropy at log2(6) bits per roll', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const rolls = requiredDiceRolls(bits)
      expect(rolls * Math.log2(6)).toBeGreaterThanOrEqual(bits)
    }
  })

  it('is the minimal such roll count', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const rolls = requiredDiceRolls(bits)
      expect((rolls - 1) * Math.log2(6)).toBeLessThan(bits)
    }
  })

  it('matches the documented counts shown to users', () => {
    expect(requiredDiceRolls(128)).toBe(50)
    expect(requiredDiceRolls(160)).toBe(62)
    expect(requiredDiceRolls(192)).toBe(75)
    expect(requiredDiceRolls(224)).toBe(87)
    expect(requiredDiceRolls(256)).toBe(100)
  })
})

describe('requiredCoinFlips', () => {
  it('needs one flip per bit', () => {
    expect(requiredCoinFlips(128)).toBe(128)
    expect(requiredCoinFlips(256)).toBe(256)
  })
})

describe('entropyFromDiceRolls', () => {
  it('returns exactly the requested number of bits', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const entropy = entropyFromDiceRolls(
        rollsFor(bits, () => 3),
        bits
      )
      expect(entropy).toHaveLength(bits)
    }
  })

  it('returns only binary digits', () => {
    const entropy = entropyFromDiceRolls(rollsFor(128, randomDiceRoll), 128)
    expect(entropy).toMatch(/^[01]+$/)
  })

  // Regression: the previous BigInt accumulator never terminated when every
  // roll was the lowest face, because the accumulated value stayed zero.
  it('accepts an all-ones roll sequence without stalling', () => {
    const rolls = rollsFor(128, () => 1)
    const entropy = entropyFromDiceRolls(rolls, 128)
    expect(entropy).toHaveLength(128)
    expect(entropy).toMatch(/1/)
  })

  it('accepts every constant-face sequence', () => {
    for (let face = 1; face <= 6; face += 1) {
      const entropy = entropyFromDiceRolls(
        rollsFor(128, () => face),
        128
      )
      expect(entropy).toHaveLength(128)
    }
  })

  it('produces distinct output for each constant face', () => {
    const outputs = new Set<string>()
    for (let face = 1; face <= 6; face += 1) {
      outputs.add(
        entropyFromDiceRolls(
          rollsFor(128, () => face),
          128
        )
      )
    }
    expect(outputs.size).toBe(6)
  })

  // Regression: leading lowest-face rolls used to be absorbed, so a 48-roll
  // log and a 47-roll log could produce byte-identical entropy.
  it('distinguishes roll logs that differ only by a leading roll', () => {
    const base = Array.from({ length: 47 }, () => 4)
    const withLeading = [1, ...base]
    expect(entropyFromDiceRolls(withLeading, 128, PARTIAL)).not.toBe(
      entropyFromDiceRolls(base, 128, PARTIAL)
    )
  })

  it('is order sensitive', () => {
    const a = entropyFromDiceRolls([1, 2, 3, 4, 5, 6], 128, PARTIAL)
    const b = entropyFromDiceRolls([6, 5, 4, 3, 2, 1], 128, PARTIAL)
    expect(a).not.toBe(b)
  })

  it('rejects too few rolls unless allowPartial is set', () => {
    expect(() => entropyFromDiceRolls([1, 2, 3], 128)).toThrow('Need at least')
    expect(entropyFromDiceRolls([1, 2, 3], 128, PARTIAL)).toHaveLength(128)
  })

  it('matches the frozen dice hash construction', () => {
    expect(entropyFromDiceRolls([1, 2, 3, 4, 5, 6], 128, PARTIAL)).toBe(
      DICE_KAT_128
    )
  })

  it('is sensitive to every roll position', () => {
    const rolls = rollsFor(128, () => 3)
    const baseline = entropyFromDiceRolls(rolls, 128)

    for (let i = 0; i < rolls.length; i += 1) {
      const mutated = [...rolls]
      mutated[i] = 4
      expect(entropyFromDiceRolls(mutated, 128)).not.toBe(baseline)
    }
  })

  it('is deterministic for the same roll log', () => {
    const rolls = rollsFor(128, randomDiceRoll)
    expect(entropyFromDiceRolls(rolls, 128)).toBe(
      entropyFromDiceRolls(rolls, 128)
    )
  })

  it('rejects faces outside [1, 6]', () => {
    expect(() => entropyFromDiceRolls([0], 128)).toThrow('Invalid dice roll')
    expect(() => entropyFromDiceRolls([7], 128)).toThrow('Invalid dice roll')
    expect(() => entropyFromDiceRolls([-1], 128)).toThrow('Invalid dice roll')
  })

  it('rejects non-integer faces', () => {
    expect(() => entropyFromDiceRolls([2.5], 128)).toThrow('Invalid dice roll')
    expect(() => entropyFromDiceRolls([Number.NaN], 128)).toThrow(
      'Invalid dice roll'
    )
  })
})

describe('entropyFromDiceRolls distribution', () => {
  // Regression: the old accumulator confined its output to [2^120, 6*2^120),
  // so the leading byte took only 5 of 256 possible values and the result
  // carried 121.8 bits instead of 128.
  it('spreads the leading byte across the full range', () => {
    const prefixes = new Set<string>()
    for (let i = 0; i < 2000; i += 1) {
      const entropy = entropyFromDiceRolls(rollsFor(128, randomDiceRoll), 128)
      prefixes.add(entropy.slice(0, 8))
    }
    expect(prefixes.size).toBeGreaterThan(200)
  })

  it('never forces leading zero bits', () => {
    let sawLeadingOne = false
    for (let i = 0; i < 200; i += 1) {
      const entropy = entropyFromDiceRolls(rollsFor(128, randomDiceRoll), 128)
      if (entropy.startsWith('1')) {
        sawLeadingOne = true
        break
      }
    }
    expect(sawLeadingOne).toBe(true)
  })

  it('keeps the leading byte near full entropy', () => {
    const samples: string[] = []
    for (let i = 0; i < 4000; i += 1) {
      samples.push(
        entropyFromDiceRolls(rollsFor(128, randomDiceRoll), 128).slice(0, 8)
      )
    }
    const h = shannonEntropy(tally(samples), samples.length)
    // Ideal is 8 bits; the estimator is capped by sample size, so allow slack.
    expect(h).toBeGreaterThan(7)
  })

  it('yields balanced bits overall', () => {
    let ones = 0
    let total = 0
    for (let i = 0; i < 400; i += 1) {
      const entropy = entropyFromDiceRolls(rollsFor(128, randomDiceRoll), 128)
      for (const bit of entropy) {
        total += 1
        if (bit === '1') {
          ones += 1
        }
      }
    }
    expect(ones / total).toBeGreaterThan(0.47)
    expect(ones / total).toBeLessThan(0.53)
  })

  // Conditioning must extract uniform output even from a degenerate input.
  it('produces uniform output from a heavily biased roll sequence', () => {
    const prefixes = new Set<string>()
    for (let i = 0; i < 1500; i += 1) {
      const rolls = rollsFor(128, () => (Math.random() < 0.95 ? 1 : 2))
      prefixes.add(entropyFromDiceRolls(rolls, 128).slice(0, 8))
    }
    expect(prefixes.size).toBeGreaterThan(150)
  })

  it('avalanches on a single roll change', () => {
    const rolls = rollsFor(256, () => 3)
    const a = entropyFromDiceRolls(rolls, 256)
    const mutated = [...rolls]
    mutated[0] = 4
    const b = entropyFromDiceRolls(mutated, 256)

    let differing = 0
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        differing += 1
      }
    }
    expect(differing).toBeGreaterThan(a.length * 0.3)
    expect(differing).toBeLessThan(a.length * 0.7)
  })
})

describe('entropyFromCoinFlips', () => {
  it('returns exactly the requested number of bits', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const flips = Array.from({ length: bits }, () => '0')
      expect(entropyFromCoinFlips(flips, bits)).toHaveLength(bits)
    }
  })

  it('accepts an all-zero flip sequence', () => {
    const entropy = entropyFromCoinFlips(
      Array.from({ length: 128 }, () => '0'),
      128
    )
    expect(entropy).toHaveLength(128)
    expect(entropy).toMatch(/1/)
  })

  it('accepts an all-one flip sequence', () => {
    const entropy = entropyFromCoinFlips(
      Array.from({ length: 128 }, () => '1'),
      128
    )
    expect(entropy).toHaveLength(128)
    expect(entropy).toMatch(/0/)
  })

  it('distinguishes all-zero from all-one input', () => {
    expect(
      entropyFromCoinFlips(
        Array.from({ length: 128 }, () => '0'),
        128
      )
    ).not.toBe(
      entropyFromCoinFlips(
        Array.from({ length: 128 }, () => '1'),
        128
      )
    )
  })

  it('is order sensitive', () => {
    const a = entropyFromCoinFlips(['0', '1', '1', '0'], 128, PARTIAL)
    const b = entropyFromCoinFlips(['0', '1', '0', '1'], 128, PARTIAL)
    expect(a).not.toBe(b)
  })

  it('rejects too few flips unless allowPartial is set', () => {
    expect(() => entropyFromCoinFlips(['0', '1'], 128)).toThrow('Need at least')
    expect(entropyFromCoinFlips(['0', '1'], 128, PARTIAL)).toHaveLength(128)
  })

  it('matches the frozen coin hash construction', () => {
    expect(
      entropyFromCoinFlips(
        ['0', '1', '0', '1', '0', '1', '0', '1'],
        128,
        PARTIAL
      )
    ).toBe(COIN_KAT_128)
  })

  it('is deterministic for the same flip log', () => {
    const flips = Array.from({ length: 128 }, randomCoinFlip)
    expect(entropyFromCoinFlips(flips, 128)).toBe(
      entropyFromCoinFlips(flips, 128)
    )
  })

  it('rejects values other than 0 and 1', () => {
    expect(() => entropyFromCoinFlips(['2'], 128)).toThrow('Invalid coin flip')
    expect(() => entropyFromCoinFlips(['h'], 128)).toThrow('Invalid coin flip')
    expect(() => entropyFromCoinFlips([''], 128)).toThrow('Invalid coin flip')
  })

  // The core coin fix: a biased physical coin or one-sided tapping must not
  // reduce the strength of the derived seed.
  it('debiases a 90/10 flip sequence into uniform output', () => {
    const prefixes = new Set<string>()
    for (let i = 0; i < 1500; i += 1) {
      const flips = Array.from({ length: 128 }, () =>
        Math.random() < 0.9 ? '0' : '1'
      )
      prefixes.add(entropyFromCoinFlips(flips, 128).slice(0, 8))
    }
    expect(prefixes.size).toBeGreaterThan(150)
  })

  it('yields balanced output bits from biased input', () => {
    let ones = 0
    let total = 0
    for (let i = 0; i < 400; i += 1) {
      const flips = Array.from({ length: 128 }, () =>
        Math.random() < 0.8 ? '0' : '1'
      )
      for (const bit of entropyFromCoinFlips(flips, 128)) {
        total += 1
        if (bit === '1') {
          ones += 1
        }
      }
    }
    expect(ones / total).toBeGreaterThan(0.47)
    expect(ones / total).toBeLessThan(0.53)
  })

  it('breaks an alternating input pattern', () => {
    const flips = Array.from({ length: 128 }, (_, i) =>
      i % 2 === 0 ? '0' : '1'
    )
    const entropy = entropyFromCoinFlips(flips, 128)
    expect(entropy).not.toMatch(/^(01)+$/)
    expect(entropy).not.toMatch(/^(10)+$/)
  })
})

describe('dice and coin domain separation', () => {
  it('produces different entropy for structurally identical inputs', () => {
    const dice = entropyFromDiceRolls([1, 1, 1, 1], 128, PARTIAL)
    const coin = entropyFromCoinFlips(['0', '0', '0', '0'], 128, PARTIAL)
    expect(dice).not.toBe(coin)
  })
})

describe('mixWithSystemEntropy', () => {
  it('returns exactly the requested number of bits', () => {
    for (const wordCount of WORD_COUNTS) {
      const bits = entropyBitsForWordCount(wordCount)
      const user = entropyFromDiceRolls(
        rollsFor(bits, () => 2),
        bits
      )
      expect(mixWithSystemEntropy(user, bits)).toHaveLength(bits)
    }
  })

  it('returns only binary digits', () => {
    const user = entropyFromDiceRolls(
      rollsFor(128, () => 2),
      128
    )
    expect(mixWithSystemEntropy(user, 128)).toMatch(/^[01]+$/)
  })

  it('is non-deterministic across calls with identical input', () => {
    const user = entropyFromDiceRolls(
      rollsFor(128, () => 2),
      128
    )
    const outputs = new Set<string>()
    for (let i = 0; i < 50; i += 1) {
      outputs.add(mixWithSystemEntropy(user, 128))
    }
    expect(outputs.size).toBe(50)
  })

  // The safety property: even a fully degenerate user sequence yields a
  // CSPRNG-strength seed once mixed.
  it('yields uniform output from a constant user input', () => {
    const user = entropyFromDiceRolls(
      rollsFor(128, () => 1),
      128
    )
    const prefixes = new Set<string>()
    for (let i = 0; i < 1500; i += 1) {
      prefixes.add(mixWithSystemEntropy(user, 128).slice(0, 8))
    }
    expect(prefixes.size).toBeGreaterThan(150)
  })

  it('differs from the unmixed user entropy', () => {
    const user = entropyFromDiceRolls(
      rollsFor(128, () => 5),
      128
    )
    expect(mixWithSystemEntropy(user, 128)).not.toBe(user)
  })
})

describe('randomIndex', () => {
  it('stays within bounds', () => {
    for (let i = 0; i < 5000; i += 1) {
      const value = randomIndex(6)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(6)
    }
  })

  it('never returns the bound itself', () => {
    for (const bound of [1, 2, 3, 6, 12, 255, 256, 2048]) {
      for (let i = 0; i < 200; i += 1) {
        expect(randomIndex(bound)).toBeLessThan(bound)
      }
    }
  })

  it('always returns 0 for a bound of 1', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(randomIndex(1)).toBe(0)
    }
  })

  it('covers every value in a small range', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i += 1) {
      seen.add(randomIndex(6))
    }
    expect(seen.size).toBe(6)
  })

  it('is close to uniform for a non-power-of-two bound', () => {
    const counts = new Map<string, number>()
    const draws = 60_000
    for (let i = 0; i < draws; i += 1) {
      const key = String(randomIndex(6))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    for (const count of counts.values()) {
      expect(count / draws).toBeGreaterThan(1 / 6 - 0.01)
      expect(count / draws).toBeLessThan(1 / 6 + 0.01)
    }
    expect(shannonEntropy(counts, draws)).toBeGreaterThan(Math.log2(6) - 0.01)
  })

  it('rejects invalid bounds', () => {
    expect(() => randomIndex(0)).toThrow('bound must be a positive integer')
    expect(() => randomIndex(-1)).toThrow('bound must be a positive integer')
    expect(() => randomIndex(2.5)).toThrow('bound must be a positive integer')
  })
})

describe('randomDiceRoll', () => {
  it('returns printed die faces in [1, 6]', () => {
    for (let i = 0; i < 5000; i += 1) {
      const roll = randomDiceRoll()
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(6)
      expect(Number.isInteger(roll)).toBe(true)
    }
  })

  it('produces every face', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 5000; i += 1) {
      seen.add(randomDiceRoll())
    }
    expect([...seen].toSorted()).toStrictEqual([1, 2, 3, 4, 5, 6])
  })

  it('generates rolls that entropyFromDiceRolls accepts', () => {
    const rolls = rollsFor(256, randomDiceRoll)
    expect(entropyFromDiceRolls(rolls, 256)).toHaveLength(256)
  })
})

describe('randomCoinFlip', () => {
  it("returns only '0' or '1'", () => {
    for (let i = 0; i < 2000; i += 1) {
      expect(['0', '1']).toContain(randomCoinFlip())
    }
  })

  it('is close to balanced', () => {
    let ones = 0
    const draws = 20_000
    for (let i = 0; i < draws; i += 1) {
      if (randomCoinFlip() === '1') {
        ones += 1
      }
    }
    expect(ones / draws).toBeGreaterThan(0.48)
    expect(ones / draws).toBeLessThan(0.52)
  })
})

describe('observedEntropyRate', () => {
  it('returns 0 for an empty sequence', () => {
    expect(observedEntropyRate([])).toBe(0)
  })

  it('returns 0 for a constant sequence', () => {
    expect(observedEntropyRate(['1', '1', '1', '1'])).toBe(0)
  })

  it('returns 1 bit for a balanced binary sequence', () => {
    expect(observedEntropyRate(['0', '1', '0', '1'])).toBeCloseTo(1, 10)
  })

  it('returns log2(6) for a uniform six-symbol sequence', () => {
    const symbols = ['1', '2', '3', '4', '5', '6']
    expect(observedEntropyRate(symbols)).toBeCloseTo(Math.log2(6), 10)
  })

  it('matches the analytic rate for a known bias', () => {
    const symbols = [
      ...Array.from({ length: 75 }, () => '0'),
      ...Array.from({ length: 25 }, () => '1')
    ]
    const expected = -(0.75 * Math.log2(0.75) + 0.25 * Math.log2(0.25))
    expect(observedEntropyRate(symbols)).toBeCloseTo(expected, 10)
  })

  it('ignores order', () => {
    const a = observedEntropyRate(['0', '0', '1', '1'])
    const b = observedEntropyRate(['0', '1', '0', '1'])
    expect(a).toBeCloseTo(b, 10)
  })
})

describe('isSequenceBiased', () => {
  it('does not judge sequences that are too short', () => {
    expect(isSequenceBiased(['0', '0', '0'], 2)).toBe(false)
  })

  it('flags a strongly one-sided coin sequence', () => {
    const flips = [
      ...Array.from({ length: 95 }, () => '0'),
      ...Array.from({ length: 5 }, () => '1')
    ]
    expect(isSequenceBiased(flips, 2)).toBe(true)
  })

  it('accepts a balanced coin sequence', () => {
    const flips = Array.from({ length: 200 }, (_, i) =>
      i % 2 === 0 ? '0' : '1'
    )
    expect(isSequenceBiased(flips, 2)).toBe(false)
  })

  it('flags a one-sided dice sequence', () => {
    const rolls = [
      ...Array.from({ length: 95 }, () => '1'),
      ...Array.from({ length: 5 }, () => '2')
    ]
    expect(isSequenceBiased(rolls, 6)).toBe(true)
  })

  it('accepts a uniform dice sequence for first-order bias', () => {
    const rolls = Array.from({ length: 300 }, (_, i) => String((i % 6) + 1))
    expect(isSequenceBiased(rolls, 6)).toBe(false)
  })

  it('accepts CSPRNG-generated dice sequences', () => {
    const rolls = Array.from({ length: 300 }, () => String(randomDiceRoll()))
    expect(isSequenceBiased(rolls, 6)).toBe(false)
  })

  it('honours a custom threshold', () => {
    const flips = [
      ...Array.from({ length: 60 }, () => '0'),
      ...Array.from({ length: 40 }, () => '1')
    ]
    expect(isSequenceBiased(flips, 2, 0.99)).toBe(true)
    expect(isSequenceBiased(flips, 2, 0.5)).toBe(false)
  })
})

describe('isSequencePatterned', () => {
  it('does not judge sequences that are too short', () => {
    expect(isSequencePatterned(['1', '2', '1', '2', '1', '2'])).toBe(false)
  })

  it('flags a repeating 1-6 cycle', () => {
    const rolls = Array.from({ length: 48 }, (_, i) => String((i % 6) + 1))
    expect(isSequencePatterned(rolls)).toBe(true)
  })

  it('flags alternating coin flips', () => {
    const flips = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0 ? '0' : '1'
    )
    expect(isSequencePatterned(flips)).toBe(true)
  })

  it('accepts a non-periodic dice sequence', () => {
    const rolls = '123156241635425163142536415263'.split('').concat('312645')
    expect(isSequencePatterned(rolls)).toBe(false)
  })
})

describe('isSequenceWeak', () => {
  it('flags first-order bias', () => {
    const flips = Array.from({ length: 100 }, () => '0')
    expect(isSequenceWeak(flips, 2)).toBe(true)
  })

  it('flags patterned but first-order-uniform input', () => {
    const rolls = Array.from({ length: 48 }, (_, i) => String((i % 6) + 1))
    expect(isSequenceBiased(rolls, 6)).toBe(false)
    expect(isSequenceWeak(rolls, 6)).toBe(true)
  })
})

describe('mixWithSystemEntropy strength', () => {
  it('rejects user entropy of the wrong width', () => {
    expect(() => mixWithSystemEntropy('01', 128)).toThrow('userEntropy')
  })

  it('folds a full-width CSPRNG contribution', () => {
    const user = entropyFromDiceRolls(
      rollsFor(128, () => 2),
      128
    )
    const spy = jest.spyOn(globalThis.crypto, 'getRandomValues')
    mixWithSystemEntropy(user, 128)
    expect(spy.mock.calls.length).toBeGreaterThan(0)
    const [[arg]] = spy.mock.calls
    expect(arg).toBeInstanceOf(Uint8Array)
    expect(arg).toHaveLength(16)
    spy.mockRestore()
  })
})
