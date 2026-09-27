import { OP_CODE_WORD } from '@/types/logic/opcode'
import { getOpcodeWord } from '@/utils/scripts'

describe('getOpcodeWord', () => {
  it('returns known opcode words as they are', () => {
    expect(getOpcodeWord('OP_CHECKSIG')).toBe(OP_CODE_WORD.OP_CHECKSIG)
    expect(getOpcodeWord('OP_RETURN')).toBe(OP_CODE_WORD.OP_RETURN)
  })

  it('maps script tokens that are not opcode words', () => {
    expect(getOpcodeWord('OP_0')).toBe(OP_CODE_WORD.OP_FALSE)
    expect(getOpcodeWord('OP_1')).toBe(OP_CODE_WORD.OP_TRUE)
    expect(getOpcodeWord('20')).toBe(OP_CODE_WORD.OP_PUSH)
    expect(getOpcodeWord('OP_5')).toBe(OP_CODE_WORD.OP_N)
    expect(getOpcodeWord('deadbeef')).toBe(OP_CODE_WORD.DATA)
  })

  it('treats object prototype keys as data', () => {
    expect(getOpcodeWord('constructor')).toBe(OP_CODE_WORD.DATA)
    expect(getOpcodeWord('toString')).toBe(OP_CODE_WORD.DATA)
  })
})
