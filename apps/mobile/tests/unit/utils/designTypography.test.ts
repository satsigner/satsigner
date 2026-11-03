import { text } from '@/styles/sizes'
import {
  textSizesAscending,
  textWeightsAscending
} from '@/utils/designTypography'

describe('textSizesAscending', () => {
  it('lists every font size token from smallest to largest', () => {
    const sizes = textSizesAscending()

    expect(sizes).toHaveLength(Object.keys(text.fontSize).length)
    expect(sizes[0]).toStrictEqual({ px: 8, size: '2xxs' })
    expect(sizes.at(-1)).toStrictEqual({ px: 62, size: '8xl' })
    for (const [index, entry] of sizes.entries()) {
      expect(entry.px).toBeGreaterThanOrEqual(sizes[Math.max(index - 1, 0)].px)
    }
  })
})

describe('textWeightsAscending', () => {
  it('lists every font weight token from lightest to boldest', () => {
    expect(textWeightsAscending().map((entry) => entry.weight)).toStrictEqual([
      'ultralight',
      'light',
      'regular',
      'medium',
      'bold'
    ])
  })
})
