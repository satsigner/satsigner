import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { toast } from 'sonner-native'

import { connectToMint } from '@/api/ecash'
import { useEcash } from '@/hooks/useEcash'
import { useEcashStore } from '@/store/ecash'

jest.mock<typeof import('@/api/ecash')>('@/api/ecash', () => ({
  ...jest.requireActual<typeof import('@/api/ecash')>('@/api/ecash'),
  connectToMint: jest.fn()
}))

const ACCOUNT_ID = 'acc-1'
const MINT_URL = 'https://unreachable.invalid'

const mountedRenderers: ReactTestRenderer[] = []

function renderUseEcash() {
  const result: { current: ReturnType<typeof useEcash> | null } = {
    current: null
  }
  function Harness() {
    result.current = useEcash()
    return null
  }
  act(() => {
    mountedRenderers.push(create(createElement(Harness)))
  })
  return result
}

describe('useEcash connectToMint', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const store = useEcashStore.getState()
    store.clearAllData()
    store.addAccount({
      createdAt: '2026-01-01T00:00:00.000Z',
      hasSeed: false,
      id: ACCOUNT_ID,
      name: 'Wallet'
    })
    store.setActiveAccountId(ACCOUNT_ID)
  })

  afterEach(() => {
    act(() => {
      for (const renderer of mountedRenderers.splice(0)) {
        renderer.unmount()
      }
    })
  })

  it('tells the user when the mint cannot be reached', async () => {
    jest
      .mocked(connectToMint)
      .mockRejectedValue(new Error('Network request failed'))
    const result = renderUseEcash()

    await expect(result.current?.connectToMint(MINT_URL)).rejects.toThrow(
      'Network request failed'
    )

    expect(toast.error).toHaveBeenCalledWith(
      'Could not connect to the mint: Network request failed'
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(useEcashStore.getState().mints[ACCOUNT_ID] ?? []).toHaveLength(0)
  })

  it('adds a reachable mint without an error', async () => {
    jest.mocked(connectToMint).mockResolvedValue({
      balance: 0,
      isConnected: true,
      keysets: [],
      name: 'Mint',
      url: MINT_URL
    })
    const result = renderUseEcash()

    await act(async () => {
      await result.current?.connectToMint(MINT_URL)
    })

    expect(toast.error).not.toHaveBeenCalled()
    expect(
      useEcashStore.getState().mints[ACCOUNT_ID]?.map(({ url }) => url)
    ).toStrictEqual([MINT_URL])
  })
})
