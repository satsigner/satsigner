import { useEffect, useState } from 'react'
import { Dimensions, View } from 'react-native'

import SSSpiralBlocks from '@/components/SSSpiralBlocks'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CANVAS_WIDTH = SCREEN_WIDTH
const CANVAS_HEIGHT = 650

const MAX_BLOCKS_PER_SPIRAL = 2016
const DATA_LINK = 'https://pvxg.net/bitcoin_data/difficulty_epochs/'

function ExplorerDifficulty() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    try {
      const fileName = getFileName(currentFileIndex)
      const response = await fetch(DATA_LINK + fileName)
      const data = await response.json()
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
        currentFileIndex={currentFileIndex}
        onChangeFileIndex={setCurrentFileIndex}
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
