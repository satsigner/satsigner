import { type Blockchain } from 'bdk-rn'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getBlockchain } from '@/api/bdk'
import {
  BLOCKSTREAM_BITCOIN_URL,
  DEFAULT_RETRIES,
  DEFAULT_STOP_GAP,
  DEFAULT_TIME_OUT,
  getBlockchainConfig,
  MEMPOOL_SIGNET_URL,
  MEMPOOL_TESTNET_URL
} from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import {
  type Network,
  type Param,
  type Server
} from '@/types/settings/blockchain'

type NetworkConfig = {
  server: Server
  param: Param
}

type BlockchainState = {
  selectedNetwork: Network
  configs: Record<Network, NetworkConfig>
  customServers: Server[]
}

type BlockchainAction = {
  setSelectedNetwork: (network: Network) => void
  updateServer: (network: Network, server: Partial<Server>) => void
  updateParam: (network: Network, param: Partial<Param>) => void
  addCustomServer: (server: Server) => void
  removeCustomServer: (server: Server) => void
  getBlockchain: (network?: Network) => Promise<Blockchain>
  getBlockchainHeight: (network?: Network) => Promise<number>
}

const createDefaultNetworkConfig = (
  network: Network,
  url: string = '',
  name: string = `Default ${network}`
): NetworkConfig => ({
  server: {
    backend: 'electrum',
    url,
    name,
    network
  },
  param: {
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
          BLOCKSTREAM_BITCOIN_URL,
          'Blockstream'
        ),
        signet: createDefaultNetworkConfig(
          'signet',
          MEMPOOL_SIGNET_URL,
          'Mempool'
        ),
        testnet: createDefaultNetworkConfig(
          'testnet',
          MEMPOOL_TESTNET_URL,
          'Mempool'
        )
      },
      customServers: [],
      setSelectedNetwork: (selectedNetwork) => set({ selectedNetwork }),
      updateServer: (network, server) => {
        const { configs } = get()
        set({
          configs: {
            ...configs,
            [network]: {
              ...configs[network],
              server: { ...configs[network].server, ...server }
            }
          }
        })
      },
      updateParam: (network, param) => {
        const { configs } = get()
        set({
          configs: {
            ...configs,
            [network]: {
              ...configs[network],
              param: { ...configs[network].param, ...param }
            }
          }
        })
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
        const { server, param } = get().configs[network]
        const config = getBlockchainConfig(server.backend, server.url, param)
        return getBlockchain(server.backend, config)
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
