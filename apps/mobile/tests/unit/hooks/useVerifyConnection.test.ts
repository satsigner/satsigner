import { markServerConnectionFailed } from '@/hooks/useVerifyConnection'
import { queryClient } from '@/lib/queryClient'

const FAILED_URL = 'tcp://umbrel.local:50001'
const OTHER_URL = 'ssl://electrum.blockstream.info:50002'

describe('markServerConnectionFailed', () => {
  afterEach(() => {
    queryClient.clear()
  })

  it('marks only the server whose sync failed', () => {
    const failedKey = ['verifyConnection', FAILED_URL, 'bitcoin', 'electrum']
    const otherKey = ['verifyConnection', OTHER_URL, 'bitcoin', 'electrum']
    queryClient.setQueryData(failedKey, 'connected')
    queryClient.setQueryData(otherKey, 'connected')

    markServerConnectionFailed(FAILED_URL)

    expect(queryClient.getQueryData(failedKey)).toBe('failed')
    expect(queryClient.getQueryData(otherKey)).toBe('connected')
  })
})
