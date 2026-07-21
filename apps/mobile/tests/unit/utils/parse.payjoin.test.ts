import { parseUriParameters } from '@/utils/parse'

describe('parseUriParameters payjoin', () => {
  it('extracts pj and pjos', () => {
    const result = parseUriParameters(
      'tb1qtest?amount=0.001&label=Hi&pjos=0&pj=https://payjo.in/mb#RK1-x'
    )
    expect(result?.pj).toBe('https://payjo.in/mb#RK1-x')
    expect(result?.pjos).toBe(0)
    expect(result?.amount).toBe(0.001)
    expect(result?.label).toBe('Hi')
  })

  it('decodes percent-encoded pj', () => {
    const result = parseUriParameters(
      'tb1qtest?pj=https%3A%2F%2Fexample.com%2Fpj'
    )
    expect(result?.pj).toBe('https://example.com/pj')
  })
})
