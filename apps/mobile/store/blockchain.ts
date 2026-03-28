import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

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
  type Server
} from '@/types/settings/blockchain'

type NetworkConfig = {
  server: Server
  config: Config
}

type BlockchainState = {
  lastKnownBlockHeight: number
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
  updateCustomServer: (oldServer: Server, newServer: Server) => void
  getBlockchainConfig: (network?: Network) => BlockchainConfig
  setLastKnownBlockHeight: (height: number) => void
}

const createDefaultNetworkConfig = (
  network: Network,
  backend: Backend,
  url: string = '',
  name: string = `Default ${network}`
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
    (set, get) => ({
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
      getBlockchainConfig: (network = get().selectedNetwork) => {
        const { server, config } = get().configs[network]

        return getBlockchainConfig(server.backend, server.url, {
          ...config,
          proxy: server.proxy
        })
      },
      setLastKnownBlockHeight: (height: number) => {
        set({ lastKnownBlockHeight: height })
      },
      lastKnownBlockHeight: 0,
      removeCustomServer: (server) => {
        const { customServers } = get()
        set({
          customServers: customServers.filter((sv) => sv !== server)
        })
      },
      selectedNetwork: 'signet',
      setSelectedNetwork: (selectedNetwork) => set({ selectedNetwork }),
      updateConfig: (network, config) => {
        set(
          produce((state: BlockchainState) => {
            state.configs[network].config = config as Config
          })
        )
      },
      updateConfigMempool: (network, config) => {
        set(
          produce((state: BlockchainState) => {
            state.configsMempool[network] = config
          })
        )
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
        set(
          produce((state: BlockchainState) => {
            state.configs[network].server = server as Server
          })
        )
      }
    }),
    {
      name: 'satsigner-blockchain',
      partialize: (state) => ({
        configs: state.configs,
        configsMempool: state.configsMempool,
        customServers: state.customServers,
        selectedNetwork: state.selectedNetwork
      }),
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useBlockchainStore }
