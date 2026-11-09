import { markServerConnectionFailed } from '@/hooks/useVerifyConnection'
import { queryClient } from '@/lib/queryClient'

const FAILED_URL = 'tcp://umbrel.local:50001'
const OTHER_URL = 'ssl://electrum.blockstream.info:50002'
const SLOW_CHECK_MS = 20

function verifyKey(url: string) {
  return ['verifyConnection', url, 'bitcoin', 'electrum']
}

function slowConnectedCheck() {
  return new Promise<string>((resolve) => {
    setTimeout(() => resolve('connected'), SLOW_CHECK_MS)
  })
}

describe('markServerConnectionFailed', () => {
  afterEach(() => {
    queryClient.clear()
  })

  it('marks only the server whose sync failed', async () => {
    queryClient.setQueryData(verifyKey(FAILED_URL), 'connected')
    queryClient.setQueryData(verifyKey(OTHER_URL), 'connected')

    await markServerConnectionFailed(FAILED_URL)

    expect(queryClient.getQueryData(verifyKey(FAILED_URL))).toBe('failed')
    expect(queryClient.getQueryData(verifyKey(OTHER_URL))).toBe('connected')
  })

  it('keeps the failure when a check still running lands later', async () => {
    const key = verifyKey(FAILED_URL)
    queryClient.setQueryData(key, 'connected')
    const runningCheck = queryClient
      .fetchQuery({ queryFn: slowConnectedCheck, queryKey: key })
      .catch(() => null)

    await markServerConnectionFailed(FAILED_URL)
    await runningCheck
    await new Promise((resolve) => {
      setTimeout(resolve, SLOW_CHECK_MS * 2)
    })

    expect(queryClient.getQueryData(key)).toBe('failed')
  })
})
