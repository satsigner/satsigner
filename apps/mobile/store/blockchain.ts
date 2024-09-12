import { Blockchain } from 'bdk-rn'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getBlockchain } from '@/api/bdk'
import { ESPLORA_MUTINYNET_URL, getBlockchainConfig } from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import { type Backend, type Network } from '@/types/settings/blockchain'

type BlockchainState = {
  backend: Backend
  network: Network
  url: string
}

type BlockchainAction = {
  getBlockchain: () => Promise<Blockchain>
  getBlockchainHeight: () => Promise<number>
}

const useBlockchainStore = create<BlockchainState & BlockchainAction>()(
  persist(
    (_set, get) => ({
      backend: 'esplora',
      network: 'signet',
      url: ESPLORA_MUTINYNET_URL,
      getBlockchain: async () => {
        const config = getBlockchainConfig(get().backend, get().url)

        return getBlockchain(get().backend, config)
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
