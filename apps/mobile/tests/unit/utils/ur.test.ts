import {
  createURBytesEncoder,
  createURStreamDecoder,
  decodeURGeneric,
  getURBytesFragments
} from '@/utils/ur'

const SAMPLE_CASHU_V3 =
  'cashuAeyJ0b2tlbiI6W3sibWludCI6Imh0dHBzOlwvXC9taW50Lm1pbmliaXRzLmNhc2hcL0JpdGNvaW4iLCJwcm9vZnMiOlt7ImFtb3VudCI6NCwiaWQiOiIwMDUwMDU1MGYwNDk0MTQ2IiwiQyI6IjAzYjhlMTk1NGZmNWMwZDQ0ZTNkY2UzYzFhYTc2NmYxNjQxYmFiODIzY2YyZjNlNTIwM2U2YmFmM2VmYTg1MWQyZCIsInNlY3JldCI6ImYzNjFhMDg0NjA2OWExNGRjYjNmNDIxYjczZjE0ZTM1NGU0MmExYmMxZmExNDMxMDU2ZTVmNTViMjRjZmJkYjcifSx7ImFtb3VudCI6MSwiaWQiOiIwMDUwMDU1MGYwNDk0MTQ2IiwiQyI6IjAzNmM1ZTkyZThmYWE2MzUwM2MxMDhmYjM5ZTUzOWFjZDMxZDcyYmFkNTNmZjliNGI0MzMzNjg5ODZlNjkyMzFhNiIsInNlY3JldCI6ImFiYTM0Y2U1ZjY2NThhMTg4MzcyY2Q5MTdlNzNjZmQwN2EyN2I0ZjZhZjY2YTdiODc5Y2YxZjZmYjk5MWUyOTIifV19XSwidW5pdCI6InNhdCIsIm1lbW8iOiJUaGUifQ=='

describe('createURBytesEncoder', () => {
  it('produces at least 2 fragments for a token larger than the fragment size', () => {
    const { totalPartCount } = createURBytesEncoder(SAMPLE_CASHU_V3, 100)
    expect(totalPartCount).toBeGreaterThan(1)
  })

  it('each fragment is a uppercase ur:bytes/... header', () => {
    const fragments = getURBytesFragments(SAMPLE_CASHU_V3, 100)
    expect(fragments.length).toBeGreaterThan(0)
    for (const fragment of fragments) {
      expect(fragment.startsWith('UR:BYTES/')).toBe(true)
    }
  })

  it('a single-fragment payload can be decoded by decodeURGeneric', () => {
    const small = `cashuA${'x'.repeat(20)}`
    const fragments = getURBytesFragments(small, 512)
    expect(fragments).toHaveLength(1)
    const decoded = decodeURGeneric(fragments[0])
    expect(decoded).toBe(small)
  })
})

describe('createURStreamDecoder', () => {
  it('accumulates fragments across calls and decodes the original payload', () => {
    const fragments = getURBytesFragments(SAMPLE_CASHU_V3, 100)
    expect(fragments.length).toBeGreaterThan(1)

    const decoder = createURStreamDecoder()
    let completeAt = -1
    for (let i = 0; i < fragments.length; i += 1) {
      decoder.receivePart(fragments[i])
      if (decoder.isComplete() && completeAt === -1) {
        completeAt = i
      }
    }

    expect(decoder.isComplete()).toBe(true)
    expect(decoder.result()).toBe(SAMPLE_CASHU_V3)
    expect(decoder.type()).toBe('bytes')
    expect(decoder.expectedPartCount()).toBe(fragments.length)
    expect(decoder.receivedPartCount()).toBe(fragments.length)
    expect(completeAt).toBeGreaterThanOrEqual(0)
  })

  it('is idempotent on duplicate fragments (dedupe-safe)', () => {
    const fragments = getURBytesFragments(SAMPLE_CASHU_V3, 100)
    const decoder = createURStreamDecoder()

    for (const fragment of fragments) {
      decoder.receivePart(fragment)
      decoder.receivePart(fragment)
      decoder.receivePart(fragment)
    }

    expect(decoder.isComplete()).toBe(true)
    expect(decoder.result()).toBe(SAMPLE_CASHU_V3)
  })

  it('reset() clears accumulated state so a new sequence can be decoded', () => {
    const fragments = getURBytesFragments(SAMPLE_CASHU_V3, 100)
    const decoder = createURStreamDecoder()

    decoder.receivePart(fragments[0])
    expect(decoder.receivedPartCount()).toBeGreaterThan(0)

    decoder.reset()
    expect(decoder.receivedPartCount()).toBe(0)
    expect(decoder.expectedPartCount()).toBe(0)
    expect(decoder.type()).toBeNull()
    expect(decoder.isComplete()).toBe(false)
    expect(decoder.result()).toBeNull()

    for (const fragment of fragments) {
      decoder.receivePart(fragment)
    }
    expect(decoder.result()).toBe(SAMPLE_CASHU_V3)
  })

  it('progress() approaches 1 as fragments arrive', () => {
    const fragments = getURBytesFragments(SAMPLE_CASHU_V3, 100)
    const decoder = createURStreamDecoder()

    let lastProgress = 0
    for (const fragment of fragments) {
      decoder.receivePart(fragment)
      const current = decoder.progress()
      expect(current).toBeGreaterThanOrEqual(lastProgress - 1e-6)
      lastProgress = current
    }
    expect(decoder.progress()).toBeGreaterThanOrEqual(1 - 1e-6)
  })

  it('ignores non-UR / malformed fragments without throwing', () => {
    const decoder = createURStreamDecoder()
    expect(() => decoder.receivePart('not a ur payload')).not.toThrow()
    expect(decoder.isComplete()).toBe(false)
    expect(decoder.result()).toBeNull()
  })
})
