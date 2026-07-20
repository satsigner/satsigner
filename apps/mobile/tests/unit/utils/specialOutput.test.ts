import {
  classifySpecialOutput,
  scriptToBytes,
  specialOutputLayoutValue
} from '@/utils/specialOutput'

describe('scriptToBytes', () => {
  it('parses hex strings', () => {
    expect(Array.from(scriptToBytes('6a0b68656c6c6f') ?? [])).toStrictEqual([
      0x6a, 0x0b, 0x68, 0x65, 0x6c, 0x6c, 0x6f
    ])
  })

  it('accepts byte arrays', () => {
    expect(Array.from(scriptToBytes([0x6a, 0x01, 0xff]) ?? [])).toStrictEqual([
      0x6a, 0x01, 0xff
    ])
  })

  it('treats ASM OP_RETURN as OP_RETURN', () => {
    expect(
      Array.from(scriptToBytes('OP_RETURN 68656c6c6f') ?? [])
    ).toStrictEqual([0x6a])
  })
})

describe('classifySpecialOutput', () => {
  it('detects empty scripts', () => {
    expect(classifySpecialOutput('')).toBe('empty')
    expect(classifySpecialOutput([])).toBe('empty')
  })

  it('detects OP_RETURN', () => {
    expect(classifySpecialOutput('6a')).toBe('op_return')
    expect(classifySpecialOutput('6a0b48656c6c6f20576f726c64')).toBe(
      'op_return'
    )
  })

  it('detects BIP141 witness commitments', () => {
    const hash = '11'.repeat(32)
    expect(classifySpecialOutput(`6a24aa21a9ed${hash}`)).toBe(
      'witness_commitment'
    )
  })

  it('returns undefined for payment scripts', () => {
    expect(classifySpecialOutput(`0014${'11'.repeat(20)}`)).toBeUndefined()
    expect(classifySpecialOutput(`5120${'22'.repeat(32)}`)).toBeUndefined()
  })
})

describe('specialOutputLayoutValue', () => {
  it('stubs zero-value special outputs for sankey width', () => {
    expect(specialOutputLayoutValue(0, 'op_return')).toBe(1)
    expect(specialOutputLayoutValue(0, 'witness_commitment')).toBe(1)
  })

  it('keeps real values and ordinary zeros', () => {
    expect(specialOutputLayoutValue(500, 'op_return')).toBe(500)
    expect(specialOutputLayoutValue(0, undefined)).toBe(0)
  })
})
