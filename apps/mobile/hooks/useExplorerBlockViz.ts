import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { fetchExplorerBlockVizFromMempool } from '@/api/explorerBlockViz'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import { time } from '@/utils/time'

export function useExplorerBlockViz(height: number | null) {
  const [selectedNetwork] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork])
  )
  const oracle = useMempoolOracle(selectedNetwork)
  const [enabled, setEnabled] = useState(false)

  const query = useQuery({
    enabled: enabled && typeof height === 'number' && height > 0,
    queryFn: () => {
      if (typeof height !== 'number') {
        throw new TypeError('missing_height')
      }
      return fetchExplorerBlockVizFromMempool(height, oracle)
    },
    queryKey: ['explorer-block-viz', height, selectedNetwork],
    staleTime: time.minutes(10)
  })

  function loadFromMempool() {
    setEnabled(true)
  }

  return {
    ...query,
    loadFromMempool,
    loaded: enabled
  }
}
