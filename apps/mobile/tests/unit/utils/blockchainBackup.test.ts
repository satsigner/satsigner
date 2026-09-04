import {
  collectBlockchainBackup,
  restoreBlockchainFromBackup
} from '@/utils/blockchainBackup'

jest.mock<typeof import('@/utils/serviceSecrets')>(
  '@/utils/serviceSecrets',
  () => ({
    loadRpcCredentials: jest.fn()
  })
)

jest.mock<typeof import('@/store/blockchain')>('@/store/blockchain', () => ({
  useBlockchainStore: { getState: jest.fn() }
}))

const { loadRpcCredentials: loadRpcCredentialsMock } = jest.requireMock(
  '@/utils/serviceSecrets'
) as { loadRpcCredentials: jest.Mock }

const CONFIG = {
  connectionMode: 'auto' as const,
  connectionTestInterval: 60,
  retries: 1,
  stopGap: 20,
  timeDiffBeforeAutoSync: 5,
  timeout: 8
}

const BITCOIN_SERVER = {
  backend: 'esplora' as const,
  name: 'Mempool',
  network: 'bitcoin' as const,
  url: 'https://mempool.space/api'
}

const SIGNET_SERVER = {
  backend: 'electrum' as const,
  name: 'Mempool',
  network: 'signet' as const,
  url: 'ssl://mempool.space:60602'
}

const TESTNET_SERVER = {
  backend: 'esplora' as const,
  name: 'Mempool',
  network: 'testnet' as const,
  url: 'https://mempool.space/testnet/api'
}

function storeSlice(overrides?: Partial<ReturnType<typeof baseSlice>>) {
  return { ...baseSlice(), ...overrides }
}

function baseSlice() {
  return {
    addCustomServer: jest.fn(),
    configs: {
      bitcoin: { config: CONFIG, server: BITCOIN_SERVER },
      signet: { config: CONFIG, server: SIGNET_SERVER },
      testnet: { config: CONFIG, server: TESTNET_SERVER }
    },
    configsMempool: {
      bitcoin: 'https://mempool.space',
      signet: 'https://mempool.space/signet',
      testnet: 'https://mempool.space/testnet'
    },
    customServers: [],
    removeCustomServer: jest.fn(),
    selectedNetwork: 'signet' as const,
    setSelectedNetwork: jest.fn(),
    updateConfig: jest.fn(),
    updateConfigMempool: jest.fn(),
    updateServer: jest.fn()
  }
}

describe('collectBlockchainBackup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadRpcCredentialsMock.mockResolvedValue(null)
  })

  it('includes in-memory rpc credentials for the bitcoin backend', async () => {
    const rpcCredentials = { password: 'p', username: 'u' }
    const backup = await collectBlockchainBackup(
      storeSlice({
        configs: {
          bitcoin: {
            config: CONFIG,
            server: {
              ...BITCOIN_SERVER,
              backend: 'rpc',
              rpcCredentials,
              url: 'http://127.0.0.1:8332'
            }
          },
          signet: { config: CONFIG, server: SIGNET_SERVER },
          testnet: { config: CONFIG, server: TESTNET_SERVER }
        },
        selectedNetwork: 'bitcoin'
      })
    )

    expect(backup.selectedNetwork).toBe('bitcoin')
    expect(backup.configs.bitcoin.server).toStrictEqual({
      ...BITCOIN_SERVER,
      backend: 'rpc',
      rpcCredentials,
      url: 'http://127.0.0.1:8332'
    })
    expect(loadRpcCredentialsMock).not.toHaveBeenCalledWith('bitcoin')
  })

  it('loads encrypted rpc credentials when memory has none', async () => {
    const rpcCredentials = { password: 'secret', username: 'rpc' }
    loadRpcCredentialsMock.mockImplementation((network: string) =>
      Promise.resolve(network === 'bitcoin' ? rpcCredentials : null)
    )

    const backup = await collectBlockchainBackup(storeSlice())

    expect(backup.configs.bitcoin.server.rpcCredentials).toStrictEqual(
      rpcCredentials
    )
    expect(loadRpcCredentialsMock).toHaveBeenCalledWith('bitcoin')
  })
})

describe('restoreBlockchainFromBackup', () => {
  it('restores bitcoin backend type, url, config, and rpc credentials', () => {
    const store = storeSlice()
    const rpcCredentials = { password: 'p', username: 'u' }
    const bitcoinConfig = {
      ...CONFIG,
      connectionMode: 'manual' as const
    }

    restoreBlockchainFromBackup(
      {
        configs: {
          bitcoin: {
            config: bitcoinConfig,
            server: {
              backend: 'rpc',
              name: 'Core',
              network: 'bitcoin',
              rpcCredentials,
              url: 'http://127.0.0.1:8332'
            }
          },
          signet: { config: CONFIG, server: SIGNET_SERVER },
          testnet: { config: CONFIG, server: TESTNET_SERVER }
        },
        configsMempool: {
          bitcoin: 'https://mempool.example',
          signet: '',
          testnet: ''
        },
        customServers: [
          {
            backend: 'electrum',
            name: 'My Electrum',
            network: 'bitcoin',
            url: 'ssl://electrum.example:50002'
          }
        ],
        selectedNetwork: 'bitcoin'
      },
      store
    )

    expect(store.setSelectedNetwork).toHaveBeenCalledWith('bitcoin')
    expect(store.updateServer).toHaveBeenCalledWith(
      'bitcoin',
      expect.objectContaining({
        backend: 'rpc',
        rpcCredentials,
        url: 'http://127.0.0.1:8332'
      })
    )
    expect(store.updateConfig).toHaveBeenCalledWith('bitcoin', bitcoinConfig)
    expect(store.updateConfigMempool).toHaveBeenCalledWith(
      'bitcoin',
      'https://mempool.example'
    )
    expect(store.addCustomServer).toHaveBeenCalledWith(
      expect.objectContaining({
        backend: 'electrum',
        url: 'ssl://electrum.example:50002'
      })
    )
  })
})
