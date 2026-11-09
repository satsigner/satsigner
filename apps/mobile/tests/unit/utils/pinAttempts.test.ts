import { toPinAttempts } from '@/utils/pinAttempts'

describe('toPinAttempts', () => {
  it('counts the tries left before the limit', () => {
    expect(toPinAttempts(2, 5)).toStrictEqual({ left: 3, status: 'counting' })
  })

  it('is exhausted once the failures reach the limit', () => {
    expect(toPinAttempts(5, 5)).toStrictEqual({ status: 'exhausted' })
  })

  it('stays exhausted when the limit was lowered below the failures', () => {
    expect(toPinAttempts(4, 3)).toStrictEqual({ status: 'exhausted' })
  })
})
