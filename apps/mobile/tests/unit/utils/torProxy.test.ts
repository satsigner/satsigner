jest.mock('@/store/blockchain', () => ({
  useBlockchainStore: {
    getState: () => ({
      configs: {},
      customServers: [],
      selectedNetwork: 'bitcoin'
    })
  }
}))

jest.mock('react-native-tcp-socket', () => {
  const handlers: Record<string, Array<(value?: unknown) => void>> = {}

  const socket = {
    destroy: jest.fn(),
    off: jest.fn((event: string, handler: (value?: unknown) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((fn) => fn !== handler)
    }),
    on: jest.fn((event: string, handler: (value?: unknown) => void) => {
      handlers[event] = [...(handlers[event] ?? []), handler]
    })
  }

  return {
    __esModule: true,
    default: {
      createConnection: jest.fn(
        (_options: unknown, callback?: () => void) => {
          setTimeout(() => {
            callback?.()
          }, 0)
          return socket
        }
      )
    }
  }
})

import { DEFAULT_TOR_PROXY } from '@/constants/branta'
import { probeTorProxy } from '@/utils/torProxy'

describe('torProxy', () => {
  it('returns true when the proxy accepts a tcp connection', async () => {
    await expect(probeTorProxy(DEFAULT_TOR_PROXY)).resolves.toBe(true)
  })
})
