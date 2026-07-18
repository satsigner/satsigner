import { formatHexDump } from '@/utils/hexDump'

describe('formatHexDump', () => {
  it('formats classic xxd-style dump with mid-gap and ascii', () => {
    // "Hello" = 48656c6c6f
    const dump = formatHexDump('48656c6c6f', 16)
    expect(dump).toBe(
      '00000000  48 65 6c 6c 6f                                    |Hello           |'
    )
  })

  it('splits across lines and shows non-printables as dots', () => {
    const hex = `${'00'.repeat(16)}41`
    const dump = formatHexDump(hex, 16)
    const lines = dump.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('|................|')
    expect(lines[1]).toContain('|A               |')
    expect(lines[1].startsWith('00000010')).toBe(true)
  })

  it('normalizes whitespace and 0x prefix', () => {
    expect(formatHexDump('0x48 65', 8)).toContain('|He')
  })

  it('returns empty string for empty input', () => {
    expect(formatHexDump('')).toBe('')
    expect(formatHexDump('   ')).toBe('')
  })
})
