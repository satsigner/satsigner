import { useEffect, useState } from 'react'
import { Dimensions, View } from 'react-native'

import SSSpiralBlocks from '@/components/SSSpiralBlocks'
import { type BlockDifficulty } from '@/types/models/Blockchain'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CANVAS_WIDTH = SCREEN_WIDTH
const CANVAS_HEIGHT = 650

const MAX_BLOCKS_PER_SPIRAL = 2016

// WARN: warn the user about where it is getting the data
const DATA_LINK = 'https://pvxg.net/bitcoin_data/difficulty_epochs/'

type DifficultyEpochsData = [
  { height: number },
  { time: number },
  { nTx: number },
  { chainwork: string },
  { nonce: number },
  { size: number },
  { weight: number },
  { block_in_cycle: number },
  { time_difference: number }
]

function ExplorerDifficulty() {
  const [data, setData] = useState<BlockDifficulty[]>([])
  const [loading, setLoading] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const fileName = getFileName(currentFileIndex)
      const response = await fetch(DATA_LINK + fileName)
      const rawData = (await response.json()) as DifficultyEpochsData[][]
      const items = rawData[0]
      const data = items.map(
        (value) =>
          ({
            height: value[0].height,
            timestamp: value[1].time,
            txCount: value[2].nTx,
            chainWork: value[3].chainwork,
            nonce: value[4].nonce,
            size: value[5].size,
            weight: value[6].weight,
            cycleHeight: value[7].block_in_cycle,
            timeDifference: value[8].time_difference
          }) as BlockDifficulty
      )
      setData(data)
    } catch (error) {
      throw new Error('Failed to fetch data:' + error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentFileIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <SSSpiralBlocks
        data={data}
        loading={loading}
        maxBlocksPerSpiral={MAX_BLOCKS_PER_SPIRAL}
        canvasWidth={CANVAS_WIDTH}
        canvasHeight={CANVAS_HEIGHT}
      />
    </View>
  )
}

function getFileName(index: number) {
  return `rcp_bitcoin_block_data_${(index * MAX_BLOCKS_PER_SPIRAL)
    .toString()
    .padStart(7, '0')}.json`
}

export default ExplorerDifficulty
