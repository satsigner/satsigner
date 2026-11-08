import {
  BRANTA_TOR_PROXY_HOST,
  BRANTA_TOR_PROXY_PORT
} from '@/constants/branta'
import {
  cancelBrantaSocks,
  isBrantaSocksAvailable,
  requestBrantaSocks
} from '@/modules/branta-socks'
import {
  brantaTorOptionVisible,
  createBrantaTorFetch
} from '@/utils/brantaTorFetch'

jest.mock<typeof import('@/modules/branta-socks')>(
  '@/modules/branta-socks',
  () => ({
    cancelBrantaSocks: jest.fn(),
    isBrantaSocksAvailable: jest.fn(() => false),
    requestBrantaSocks: jest.fn(async () => ({ body: '{}', status: 200 }))
  })
)

const request = jest.mocked(requestBrantaSocks)
const cancel = jest.mocked(cancelBrantaSocks)
const available = jest.mocked(isBrantaSocksAvailable)

describe('brantaTorOptionVisible', () => {
  afterEach(() => {
    available.mockReturnValue(false)
  })

  it('hides Tor when the build has no proxy module', () => {
    expect(brantaTorOptionVisible(false)).toBe(false)
  })

  it('keeps Tor visible while on so it can be turned off', () => {
    expect(brantaTorOptionVisible(true)).toBe(true)
  })

  it('shows Tor when the proxy module is present', () => {
    available.mockReturnValue(true)
    expect(brantaTorOptionVisible(false)).toBe(true)
  })
})

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
