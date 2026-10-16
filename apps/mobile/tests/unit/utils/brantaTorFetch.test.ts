import {
  BRANTA_TOR_PROXY_HOST,
  BRANTA_TOR_PROXY_PORT
} from '@/constants/branta'
import { cancelBrantaSocks, requestBrantaSocks } from '@/modules/branta-socks'
import { createBrantaTorFetch } from '@/utils/brantaTorFetch'

jest.mock<typeof import('@/modules/branta-socks')>(
  '@/modules/branta-socks',
  () => ({
    cancelBrantaSocks: jest.fn(),
    requestBrantaSocks: jest.fn(async () => ({ body: '{}', status: 200 }))
  })
)

const request = jest.mocked(requestBrantaSocks)
const cancel = jest.mocked(cancelBrantaSocks)

describe('createBrantaTorFetch', () => {
  beforeEach(() => {
    request.mockClear()
    cancel.mockClear()
    request.mockResolvedValue({ body: '{}', status: 200 })
  })

  it('sends https lookups through the Orbot proxy', async () => {
    const fetchImpl = createBrantaTorFetch()
    const response = await fetchImpl(
      'https://guardrail.branta.pro/v2/payments/abc',
      {
        method: 'GET'
      }
    )

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('{}')
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(/^branta-tor-/),
      'https://guardrail.branta.pro/v2/payments/abc',
      'GET',
      {},
      '',
      BRANTA_TOR_PROXY_HOST,
      BRANTA_TOR_PROXY_PORT
    )
  })

  it('does not call the proxy for a clearnet http URL', async () => {
    const fetchImpl = createBrantaTorFetch()

    await expect(
      fetchImpl('http://guardrail.branta.pro/v2/payments/abc')
    ).rejects.toThrow('https')

    expect(request).not.toHaveBeenCalled()
  })
})
