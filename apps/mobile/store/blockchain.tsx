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
  getEstimatedFee: (confirmationTarget?: number) => Promise<number>
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
      },
      getEstimatedFee: async (confirmationTarget: number = 6) => {
        const blockchain = await get().getBlockchain()
        const estimatedFee = await blockchain.estimateFee(confirmationTarget)

        if (estimatedFee === undefined) {
          throw new Error(
            `No fee estimate available for ${confirmationTarget} block confirmation target`
          )
        }

        return estimatedFee.asSatPerVb() //
      }
    }),
    {
      name: 'satsigner-blockchain',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useBlockchainStore }
