import { estimatePassphraseStrength } from '@/utils/passphraseStrength'

describe('estimatePassphraseStrength', () => {
  it('treats empty input as empty', () => {
    expect(estimatePassphraseStrength('')).toStrictEqual({
      bits: 0,
      level: 'empty'
    })
  })

  it('caps trivial passwords as weak', () => {
    for (const pw of ['password', 'bitcoin', 'satoshi', 'qwerty', '123456']) {
      const result = estimatePassphraseStrength(pw)
      expect(result.level).toBe('weak')
      expect(result.bits).toBeLessThanOrEqual(10)
    }
  })

  it('caps single dictionary words regardless of length', () => {
    // Pool math would give ~56 bits for 12 lowercase chars; a dictionary
    // word is drawn from a far smaller space.
    const result = estimatePassphraseStrength('correcthorse')
    expect(result.level).toBe('weak')
    expect(result.bits).toBeLessThanOrEqual(18)
  })

  it('caps repeated characters', () => {
    const result = estimatePassphraseStrength('aaaaaaaaaaaaaaaa')
    expect(result.level).toBe('weak')
    expect(result.bits).toBeLessThanOrEqual(7)
  })

  it('rates short mixed-character passphrases as weak', () => {
    const result = estimatePassphraseStrength('abc123')
    expect(result.level).toBe('weak')
  })

  it('rates moderate mixed passphrases as fair', () => {
    // 11 chars over a 94-char pool ≈ 72 bits
    const result = estimatePassphraseStrength('Tr0ub4dor&3')
    expect(result.level).toBe('fair')
    expect(result.bits).toBeGreaterThanOrEqual(50)
    expect(result.bits).toBeLessThan(80)
  })

  it('rates long high-pool passphrases as strong', () => {
    const result = estimatePassphraseStrength('Xk9#mQ2$vL8@pN4&zR6!')
    expect(result.level).toBe('strong')
    expect(result.bits).toBeGreaterThanOrEqual(80)
  })

  it('thresholds are inclusive at the boundaries', () => {
    // 94-char pool: 8 chars ≈ 52 bits (fair), 13 chars ≈ 85 bits (strong)
    expect(estimatePassphraseStrength('aB1!cD2#').level).toBe('fair')
    expect(estimatePassphraseStrength('aB1!cD2#eF3$g').level).toBe('strong')
  })
})
