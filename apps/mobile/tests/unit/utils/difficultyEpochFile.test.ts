import { ZodError } from 'zod'

import { parseDifficultyEpochFile } from '@/utils/difficultyEpochFile'

const blockRow = [
  { height: 858_816 },
  { time: 1_724_855_515 },
  { nTx: 3354 },
  {
    chainwork:
      '00000000000000000000000000000000000000008b5c9cf9927090728814bee2'
  },
  { nonce: 1_792_826_660 },
  { size: 1_603_784 },
  { weight: 3_993_074 },
  { block_in_cycle: 0 },
  { time_difference: 1102 }
]

describe('parseDifficultyEpochFile', () => {
  it('returns the block rows of the first entry', () => {
    const [rows] = parseDifficultyEpochFile([[blockRow, blockRow]])

    expect(rows).toHaveLength(2)
    expect(rows[0][0].height).toBe(858_816)
    expect(rows[0][3].chainwork).toBe(
      '00000000000000000000000000000000000000008b5c9cf9927090728814bee2'
    )
    expect(rows[0][8].time_difference).toBe(1102)
  })

  it('ignores extra trailing entries in a row', () => {
    const [rows] = parseDifficultyEpochFile([[[...blockRow, { extra: 1 }]]])

    expect(rows[0][7].block_in_cycle).toBe(0)
  })

  it('rejects rows with missing entries', () => {
    expect(() => parseDifficultyEpochFile([[blockRow.slice(0, 8)]])).toThrow(
      ZodError
    )
  })

  it('rejects rows with wrongly typed values', () => {
    const [height, time, nTx, , ...rest] = blockRow
    const badRow = [height, time, nTx, { chainwork: 1 }, ...rest]

    expect(() => parseDifficultyEpochFile([[badRow]])).toThrow(ZodError)
  })

  it('rejects an empty file', () => {
    expect(() => parseDifficultyEpochFile([])).toThrow(ZodError)
  })
})
