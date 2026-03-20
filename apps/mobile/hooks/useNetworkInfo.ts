import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { useBlockchainStore } from '@/store/blockchain'

export type BlockHeightSource = 'backend' | 'mempool'

export function useNetworkInfo() {
  const [selectedNetwork, configsMempool, configs] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configsMempool,
      state.configs
    ])
  )

  const [blockHeight, setBlockHeight] = useState<number | null>(null)
  const [nextBlockFee, setNextBlockFee] = useState<number | null>(null)
  const [blockHeightSource, setBlockHeightSource] =
    useState<BlockHeightSource>('mempool')

  const fetchNetworkInfo = useCallback(async () => {
    const { server } = configs[selectedNetwork]
    let height: number | null = null
    let source: BlockHeightSource = 'mempool'

    // Try configured Esplora server for block height only
    if (server.backend === 'esplora' && server.url) {
      try {
        const esplora = new Esplora(server.url)
        const rawHeight = await esplora.getLatestBlockHeight()
        height = Number(rawHeight)
        source = 'backend'
      } catch {
        // fall through to mempool
      }
    }

    // Try configured Electrum server for block height only
    else if (server.backend === 'electrum' && server.url) {
      let client: ElectrumClient | null = null
      try {
        client = ElectrumClient.fromUrl(server.url, selectedNetwork)
        await client.init()
        const tip = await (client.client as any).blockchainHeaders_subscribe()
        if (tip?.height) {
          height = tip.height as number
          source = 'backend'
        }
      } catch {
        // fall through to mempool
      } finally {
        try {
          client?.close()
        } catch {}
      }
    }

    // Always get fee rates and block height (if missing) from mempool.space
    let fee: number | null = null
    try {
      const mempoolUrl = configsMempool[selectedNetwork]
      const oracle = new MempoolOracle(mempoolUrl)
      const [mempoolHeight, fees] = await Promise.all([
        height === null
          ? oracle.getCurrentBlockHeight()
          : Promise.resolve(null),
        oracle.getMemPoolFees()
      ])
      if (height === null && mempoolHeight !== null) {
        height = mempoolHeight as number
        source = 'mempool'
      }
      if (fees?.high != null) {
        fee = fees.high
      }
    } catch {
      // keep previous values
    }

    if (height !== null) setBlockHeight(height)
    if (fee !== null) setNextBlockFee(Math.round(fee))
    setBlockHeightSource(source)
  }, [selectedNetwork, configsMempool, configs])

  useEffect(() => {
    fetchNetworkInfo()
    const interval = setInterval(fetchNetworkInfo, 30000)
    return () => clearInterval(interval)
  }, [fetchNetworkInfo])

  return { blockHeight, nextBlockFee, blockHeightSource }
}
