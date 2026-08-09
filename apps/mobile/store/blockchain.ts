import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

import {
  type BlockchainConfig,
  DEFAULT_RETRIES,
  DEFAULT_STOP_GAP,
  DEFAULT_TIME_OUT,
  getBlockchainConfig,
  MEMPOOL_MAINNET_URL,
  MEMPOOL_SIGNET_URL,
  MEMPOOL_TESTNET_URL
} from '@/config/servers'
import { MempoolServers } from '@/constants/servers'
import mmkvStorage from '@/storage/mmkv'
import {
  type Backend,
  type Config,
  type Network,
  NetworkSchema,
  type Server
} from '@/types/settings/blockchain'
import { persistRpcCredentialsSafe } from '@/utils/serviceSecrets'

const NETWORKS: Network[] = NetworkSchema.options

type NetworkConfig = {
  server: Server
  config: Config
}

type BlockchainState = {
  lastKnownBlockHeight: number
  nextBlockFee: number | null
  selectedNetwork: Network
  configs: Record<Network, NetworkConfig>
  configsMempool: Record<Network, Server['url']>
  customServers: Server[]
}

type BlockchainAction = {
  setSelectedNetwork: (network: Network) => void
  updateServer: (network: Network, server: Partial<Server>) => void
  updateConfig: (network: Network, config: Partial<Config>) => void
  updateConfigMempool: (network: Network, url: Server['url']) => void
  addCustomServer: (server: Server) => void
  removeCustomServer: (server: Server) => void
  stripAllRpcCredentials: () => void
  updateCustomServer: (oldServer: Server, newServer: Server) => void
  getBlockchain: (network?: Network) => BlockchainConfig
  setLastKnownBlockHeight: (height: number) => void
  setNextBlockFee: (fee: number | null) => void
}

const createDefaultNetworkConfig = (
  network: Network,
  backend: Backend,
  url = '',
  name = `Default ${network}`
): NetworkConfig => ({
  config: {
    connectionMode: 'auto',
    connectionTestInterval: 60,
    retries: DEFAULT_RETRIES,
    stopGap: DEFAULT_STOP_GAP,
    timeDiffBeforeAutoSync: 30,
    timeout: DEFAULT_TIME_OUT
  },
  server: {
    backend,
    name,
    network,
    url
  }
})

const useBlockchainStore = create<BlockchainState & BlockchainAction>()(
  persist(
    immer((set, get) => ({
      addCustomServer: (server) => {
        const { customServers } = get()
        set({ customServers: [...customServers, server] })
      },
      configs: {
        bitcoin: createDefaultNetworkConfig(
          'bitcoin',
          'esplora',
          MEMPOOL_MAINNET_URL,
          'Mempool'
        ),
        signet: createDefaultNetworkConfig(
          'signet',
          'electrum',
          MEMPOOL_SIGNET_URL,
          'Mempool'
        ),
        testnet: createDefaultNetworkConfig(
          'testnet',
          'esplora',
          MEMPOOL_TESTNET_URL,
          'Mempool'
        )
      },
      configsMempool: MempoolServers,
      customServers: [],
      getBlockchain: (network = get().selectedNetwork) => {
        const { server, config } = get().configs[network]

        return getBlockchainConfig(server.backend, server.url, {
          ...config,
          proxy: server.proxy
        })
      },
      lastKnownBlockHeight: 0,
      nextBlockFee: null,
      removeCustomServer: (server) => {
        const { customServers } = get()
        set({
          customServers: customServers.filter((sv) => sv !== server)
        })
      },
      selectedNetwork: 'signet',
      setLastKnownBlockHeight: (height: number) => {
        set({ lastKnownBlockHeight: height })
      },
      setNextBlockFee: (fee: number | null) => {
        set({ nextBlockFee: fee })
      },
      setSelectedNetwork: (selectedNetwork) => set({ selectedNetwork }),
      stripAllRpcCredentials: () => {
        set((state) => {
          for (const network of NETWORKS) {
            const { rpcCredentials: _removed, ...rest } =
              state.configs[network].server
            state.configs[network].server = rest
          }
          state.customServers = state.customServers.map((server) => {
            const { rpcCredentials: _removed, ...rest } = server
            return rest
          })
        })
      },
      updateConfig: (network, config) => {
        set((state) => {
          state.configs[network].config = config as Config
        })
      },
      updateConfigMempool: (network, config) => {
        set((state) => {
          state.configsMempool[network] = config
        })
      },
      updateCustomServer: (oldServer, newServer) => {
        const { customServers } = get()
        set({
          customServers: customServers.map((s) =>
            s.url === oldServer.url &&
            s.name === oldServer.name &&
            s.network === oldServer.network
              ? newServer
              : s
          )
        })
      },
      updateServer: (network, server) => {
        if (server.rpcCredentials) {
          void persistRpcCredentialsSafe(network, server.rpcCredentials)
        }
        set((state) => {
          state.configs[network].server = server as Server
        })
      }
    })),
    {
      name: 'satsigner-blockchain',
      partialize: (state) => ({
        configs: {
          bitcoin: {
            ...state.configs.bitcoin,
            server: {
              ...state.configs.bitcoin.server,
              rpcCredentials: undefined
            }
          },
          signet: {
            ...state.configs.signet,
            server: {
              ...state.configs.signet.server,
              rpcCredentials: undefined
            }
          },
          testnet: {
            ...state.configs.testnet,
            server: {
              ...state.configs.testnet.server,
              rpcCredentials: undefined
            }
          }
        },
        configsMempool: state.configsMempool,
        customServers: state.customServers,
        selectedNetwork: state.selectedNetwork
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useBlockchainStore }
