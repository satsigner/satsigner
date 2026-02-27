import { useCallback, useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import { useBlockchainStore } from '@/store/blockchain'

export function useNetworkInfo() {
  const [selectedNetwork, configsMempool] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configsMempool])
  )

  const [blockHeight, setBlockHeight] = useState<number | null>(null)
  const [nextBlockFee, setNextBlockFee] = useState<number | null>(null)

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const mempoolUrl = configsMempool[selectedNetwork]
      const oracle = new MempoolOracle(mempoolUrl)

      const [height, fees] = await Promise.all([
        oracle.getCurrentBlockHeight(),
        oracle.getMemPoolFees()
      ])

      setBlockHeight(height)
      setNextBlockFee(fees.high)
    } catch {
      // Keep previous values on error
    }
  }, [selectedNetwork, configsMempool])

  useEffect(() => {
    fetchNetworkInfo()
    const interval = setInterval(fetchNetworkInfo, 30000)
    return () => clearInterval(interval)
  }, [fetchNetworkInfo])

  return { blockHeight, nextBlockFee }
}
