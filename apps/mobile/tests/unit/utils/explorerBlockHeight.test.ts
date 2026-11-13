import { parseBlockHeightInput } from '@/utils/explorerBlockHeight'

const MAX_HEIGHT = 330_000

describe('parseBlockHeightInput', () => {
  it.each([
    ['0', 0],
    ['42', 42],
    ['0042', 42],
    ['330000', MAX_HEIGHT]
  ])('reads %p as height %p', (text, height) => {
    expect(parseBlockHeightInput(text, MAX_HEIGHT)).toBe(height)
  })

  it.each(['', '330001', '99999999', '1.5', '-1', ' 1', '1e3'])(
    'rejects %p',
    (text) => {
      expect(parseBlockHeightInput(text, MAX_HEIGHT)).toBeNull()
    }
  )
})
