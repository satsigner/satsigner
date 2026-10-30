import {
  isConnectionPollSuppressed,
  subscribeToConnectionPollSuppression,
  suppressConnectionPoll
} from '@/utils/connectionPollSuppression'

describe('connectionPollSuppression', () => {
  it('suppresses polling for a network until released', () => {
    const release = suppressConnectionPoll('signet')

    expect(isConnectionPollSuppressed('signet')).toBe(true)
    expect(isConnectionPollSuppressed('bitcoin')).toBe(false)

    release()

    expect(isConnectionPollSuppressed('signet')).toBe(false)
  })

  it('notifies subscribers when suppression starts and ends', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToConnectionPollSuppression(listener)

    const release = suppressConnectionPoll('testnet')
    expect(listener).toHaveBeenCalledTimes(1)

    release()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    suppressConnectionPoll('testnet')()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
