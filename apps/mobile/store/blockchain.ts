import { type Blockchain } from 'bdk-rn'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getBlockchain } from '@/api/bdk'
import {
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
  getBlockchain: (network?: Network) => Promise<Blockchain>
  getBlockchainHeight: (network?: Network) => Promise<number>
}

const createDefaultNetworkConfig = (
  network: Network,
  backend: Backend,
  url: string = '',
  name: string = `Default ${network}`
): NetworkConfig => ({
  server: {
    backend,
    url,
    name,
    network
  },
  config: {
    timeout: DEFAULT_TIME_OUT,
    retries: DEFAULT_RETRIES,
    stopGap: DEFAULT_STOP_GAP,
    connectionMode: 'auto',
    connectionTestInterval: 60,
    timeDiffBeforeAutoSync: 30
  }
})

const useBlockchainStore = create<BlockchainState & BlockchainAction>()(
  persist(
    (set, get) => ({
      lastKnownBlockHeight: 0,
      selectedNetwork: 'signet',
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
      setSelectedNetwork: (selectedNetwork) => set({ selectedNetwork }),
      updateServer: (network, server) => {
        set(
          produce((state: BlockchainState) => {
            state.configs[network].server = server as Server
          })
        )
      },
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
      addCustomServer: (server) => {
        const { customServers } = get()
        set({ customServers: [...customServers, server] })
      },
      removeCustomServer: (server) => {
        const { customServers } = get()
        set({
          customServers: customServers.filter((sv) => sv !== server)
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
      getBlockchain: async (network = get().selectedNetwork) => {
        const { server, config } = get().configs[network]

        const blockchainConfig = getBlockchainConfig(
          server.backend,
          server.url,
          {
            ...config,
            proxy: server.proxy
          }
        )

        return getBlockchain(server.backend, blockchainConfig)
      },
      getBlockchainHeight: async (network = get().selectedNetwork) => {
        const blockchain = await get().getBlockchain(network)
        const height = await blockchain.getHeight()
        set({ lastKnownBlockHeight: height })
        return height
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
