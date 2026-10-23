import { isSuccessfulHttpStatus } from '@/utils/http'

describe('isSuccessfulHttpStatus', () => {
  it('accepts 2xx statuses', () => {
    expect(isSuccessfulHttpStatus(200)).toBe(true)
    expect(isSuccessfulHttpStatus(299)).toBe(true)
  })

  it('rejects statuses outside 2xx', () => {
    expect(isSuccessfulHttpStatus(199)).toBe(false)
    expect(isSuccessfulHttpStatus(300)).toBe(false)
    expect(isSuccessfulHttpStatus(404)).toBe(false)
  })
})
