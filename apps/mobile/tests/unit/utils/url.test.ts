import { isValidPort } from '@/utils/url'

describe('isValidPort', () => {
  it.each(['1', '80', '50002', '65535'])('accepts %s', (port) => {
    expect(isValidPort(port)).toBe(true)
  })

  it.each(['0', '65536', '99999', '', ' 80', '80a', '-1', '1.5'])(
    'rejects %p',
    (port) => {
      expect(isValidPort(port)).toBe(false)
    }
  )
})
