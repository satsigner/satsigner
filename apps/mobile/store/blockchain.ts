import { Blockchain } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getBlockchain } from '@/api/bdk'
import { ESPLORA_MUTINYNET_URL, getBlockchainConfig } from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import { type Backend } from '@/types/settings/blockchain'

type BlockchainState = {
  backend: Backend
  network: Network
  url: string
  timeout: number
  retries: number
  stopGap: number
}

type BlockchainAction = {
  setBackend: (backend: Backend) => void
  setNetwork: (network: Network) => void
  setUrl: (url: string) => void
  setTimeout: (timeout: number) => void
  setStopGap: (stopGap: number) => void
  setRetries: (retries: number) => void
  getBlockchain: () => Promise<Blockchain>
  getBlockchainHeight: () => Promise<number>
}

const useBlockchainStore = create<BlockchainState & BlockchainAction>()(
  persist(
    (set, get) => ({
      backend: 'esplora',
      network: Network.Signet,
      url: ESPLORA_MUTINYNET_URL,
      timeout: 6,
      retries: 7,
      stopGap: 20,
      setBackend: (backend) => {
        set({ backend })
      },
      setNetwork: (network) => {
        set({ network })
      },
      setUrl: (url) => {
        set({ url })
      },
      setTimeout: (timeout) => {
        set({ timeout })
      },
      setStopGap: (stopGap) => {
        set({ stopGap })
      },
      setRetries: (retries) => {
        set({ retries })
      },
      getBlockchain: async () => {
        const { backend, retries, stopGap, timeout, url } = get()
        const opts = { retries, stopGap, timeout }
        const config = getBlockchainConfig(backend, url, opts)
        return getBlockchain(backend, config)
      },
      getBlockchainHeight: async () => {
        return (await get().getBlockchain()).getHeight()
      }
    }),
    {
      name: 'satsigner-blockchain',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useBlockchainStore }
