import {
  EXPLORER_REQUEST_TIMEOUT_MS,
  EXPLORER_REQUEST_TOR_TIMEOUT_MS
} from '@/constants/explorer'
import { withExplorerTimeout } from '@/utils/explorerTimeout'

const ONION_URL = `ssl://${'a'.repeat(56)}.onion:50002`

function neverSettles() {
  return new Promise<never>(() => {})
}

describe('withExplorerTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('gives up on a stalled clearnet server', async () => {
    const onResult = jest.fn()
    withExplorerTimeout(
      neverSettles(),
      'ssl://electrum.example.com:50002'
    ).catch(onResult)

    await jest.advanceTimersByTimeAsync(EXPLORER_REQUEST_TIMEOUT_MS)

    expect(onResult).toHaveBeenCalledWith(new Error('timeout'))
  })

  it('gives an onion server longer to answer', async () => {
    const onResult = jest.fn()
    withExplorerTimeout(neverSettles(), ONION_URL).catch(onResult)

    await jest.advanceTimersByTimeAsync(EXPLORER_REQUEST_TIMEOUT_MS)
    expect(onResult).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(
      EXPLORER_REQUEST_TOR_TIMEOUT_MS - EXPLORER_REQUEST_TIMEOUT_MS
    )
    expect(onResult).toHaveBeenCalledWith(new Error('timeout'))
  })

  it('passes a result through', async () => {
    await expect(
      withExplorerTimeout(Promise.resolve(42), 'https://mempool.space/api')
    ).resolves.toBe(42)
  })
})
