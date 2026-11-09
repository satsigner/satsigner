import ElectrumClient from '@/api/electrum'
import {
  assertElectrumReachable,
  clearElectrumReachabilityChecks
} from '@/api/electrumReachability'
import {
  CONNECTION_TEST_TIMEOUT_MS,
  CONNECTION_TEST_TOR_TIMEOUT_MS,
  ELECTRUM_REACHABILITY_TTL_MS
} from '@/constants/connectionTest'

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  __esModule: true,
  default: { test: jest.fn() }
}))

const mockTest = jest.mocked(ElectrumClient.test)
const HOME_NODE = 'tcp://192.168.0.13:50001'

describe('assertElectrumReachable', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearElectrumReachabilityChecks()
  })

  it('passes when the server answers the ping', async () => {
    mockTest.mockResolvedValueOnce(true)

    await expect(assertElectrumReachable(HOME_NODE, 0)).resolves.toBeUndefined()
    expect(mockTest).toHaveBeenCalledWith(
      HOME_NODE,
      'bitcoin',
      CONNECTION_TEST_TIMEOUT_MS
    )
  })

  it('fails fast with the server name when it does not answer', async () => {
    mockTest.mockResolvedValueOnce(false)

    await expect(assertElectrumReachable(HOME_NODE, 0)).rejects.toThrow(
      'Electrum server 192.168.0.13:50001 is unreachable'
    )
  })

  it('shares one check between accounts syncing at the same time', async () => {
    mockTest.mockResolvedValueOnce(false)

    const results = await Promise.allSettled([
      assertElectrumReachable(HOME_NODE, 0),
      assertElectrumReachable(HOME_NODE, 10),
      assertElectrumReachable(HOME_NODE, 20)
    ])

    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(mockTest).toHaveBeenCalledTimes(1)
  })

  it('checks again once the cached result is stale', async () => {
    mockTest.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    await expect(assertElectrumReachable(HOME_NODE, 0)).rejects.toThrow(
      'is unreachable'
    )
    await expect(
      assertElectrumReachable(HOME_NODE, ELECTRUM_REACHABILITY_TTL_MS)
    ).resolves.toBeUndefined()
    expect(mockTest).toHaveBeenCalledTimes(2)
  })
})

describe('assertElectrumReachable over Tor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearElectrumReachabilityChecks()
  })

  it('gives an onion server longer to answer', async () => {
    const onion =
      'tcp://explorerzydxu5ecjrkwceayqybizmpjjznk5izmitf2modhcusuqlid.onion:50001'
    mockTest.mockResolvedValueOnce(true)

    await assertElectrumReachable(onion, 0)

    expect(mockTest).toHaveBeenCalledWith(
      onion,
      'bitcoin',
      CONNECTION_TEST_TOR_TIMEOUT_MS
    )
  })
})
