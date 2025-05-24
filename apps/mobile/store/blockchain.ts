import { type Blockchain } from 'bdk-rn'
import { produce } from 'immer'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getBlockchain } from '@/api/bdk'
import {
  DEFAULT_RETRIES,
  DEFAULT_STOP_GAP,
  DEFAULT_TIME_OUT,
  ELECTRUM_URL,
  getBlockchainConfig,
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
    connectionTestInterval: 60
  }
})

const useBlockchainStore = create<BlockchainState & BlockchainAction>()(
  persist(
    (set, get) => ({
      selectedNetwork: 'signet',
      configs: {
        bitcoin: createDefaultNetworkConfig(
          'bitcoin',
          'electrum',
          ELECTRUM_URL,
          'Blockstream'
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
      getBlockchain: async (network = get().selectedNetwork) => {
        const { server, config } = get().configs[network]
        const blockchainConfig = getBlockchainConfig(
          server.backend,
          server.url,
          config
        )
        return getBlockchain(server.backend, blockchainConfig)
      },

      getBlockchainHeight: async (network = get().selectedNetwork) => {
        return (await get().getBlockchain(network)).getHeight()
      }
    }),
    {
      name: 'satsigner-blockchain',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useBlockchainStore }
