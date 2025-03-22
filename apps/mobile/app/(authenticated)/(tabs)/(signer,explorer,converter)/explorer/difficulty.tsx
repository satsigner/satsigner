import { useEffect, useState } from 'react'
import { Dimensions, View } from 'react-native'

import { MempoolOracle } from '@/api/blockchain'
import SSSpiralBlocks from '@/components/SSSpiralBlocks'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import {
  type BlockDifficulty,
  type DifficultyAdjustment
} from '@/types/models/Blockchain'

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

function formatTimeFromNow(milliseconds: number): string {
  const seconds = milliseconds / 1000
  const minutes = seconds / 60
  const hours = minutes / 60
  const days = hours / 24
  const weeks = days / 7
  const months = days / 30 // Approximate
  const years = days / 365 // Approximate

  if (years >= 1) {
    return `in ~${years.toFixed(1)} years`
  }
  if (months >= 1) {
    return `in ~${months.toFixed(1)} months`
  }
  if (weeks >= 1) {
    return `in ~${weeks.toFixed(1)} weeks`
  }
  if (days >= 1) {
    return `in ~${days.toFixed(1)} days`
  }
  if (hours >= 1) {
    return `in ~${hours.toFixed(1)} hours`
  }
  if (minutes >= 1) {
    return `in ~${minutes.toFixed(1)} minutes`
  }
  return `in ~${seconds.toFixed(1)} seconds`
}

function ExplorerDifficulty() {
  const [data, setData] = useState<BlockDifficulty[]>([])
  const [loading, setLoading] = useState(false)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [averageBlockTime, setAverageBlockTime] = useState('unknown')
  const [remainingTime, setRemainingTime] = useState('unknown')

  async function fetchDifficultyAdjustment() {
    const mempoolOracle = new MempoolOracle()
    const response =
      (await mempoolOracle.getDifficultyAdjustment()) as DifficultyAdjustment
    const avgTimeInSeconds = response.timeAvg / 1000
    const avgTimeInMinutes = avgTimeInSeconds / 60
    setAverageBlockTime(avgTimeInMinutes.toFixed(1))
    setRemainingTime(formatTimeFromNow(response.remainingTime))
  }

  useEffect(() => {
    fetchDifficultyAdjustment()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
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
    <SSMainLayout style={{ backgroundColor: 'black' }}>
      <SSHStack justifyBetween>
        <SSVStack gap="none">
          <SSText weight="bold" size="lg">
            ~{averageBlockTime} minutes
          </SSText>
          <SSText color="muted" size="md">
            Average Block Time
          </SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText weight="bold" size="lg" style={{ textAlign: 'right' }}>
            {remainingTime}
          </SSText>
          <SSText color="muted" size="md" style={{ textAlign: 'right' }}>
            Next Difficulty Adjustment
          </SSText>
        </SSVStack>
      </SSHStack>
      <View style={{ marginTop: 30, flex: 1 }}>
        <SSSpiralBlocks
          data={data}
          loading={loading}
          maxBlocksPerSpiral={MAX_BLOCKS_PER_SPIRAL}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={CANVAS_HEIGHT}
        />
      </View>
    </SSMainLayout>
  )
}

function getFileName(index: number) {
  return `rcp_bitcoin_block_data_${(index * MAX_BLOCKS_PER_SPIRAL)
    .toString()
    .padStart(7, '0')}.json`
}

export default ExplorerDifficulty
