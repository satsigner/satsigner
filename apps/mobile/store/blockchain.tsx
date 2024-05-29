import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { exploraMutiny } from '@/config/servers'
import mmkvStorage from '@/storage/mmkv'
import { type Backend, type Network } from '@/types/settings/blockchain'

type BlockchainState = {
  backend: Backend
  network: Network
  url: string
}

type BlockchainAction = object

const useBlockchainStore = create<BlockchainState & BlockchainAction>()(
  persist(
    (set) => ({
      backend: 'esplora',
      network: 'signet',
      url: exploraMutiny.baseUrl
    }),
    {
      name: 'satsigner-blockchain',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useBlockchainStore }
