import { useEffect, useState } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'

import { MempoolOracle } from '@/api/blockchain'
import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSSpiralBlocks from '@/components/SSSpiralBlocks'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import {
  type BlockDifficulty,
  type DifficultyAdjustment
} from '@/types/models/Blockchain'
import { formatDate } from '@/utils/format'

const { width: SCREEN_WIDTH, height: _SCREEN_HEIGHT } = Dimensions.get('window')
const CANVAS_WIDTH = SCREEN_WIDTH
const CANVAS_HEIGHT = 650

const BLOCKS_PER_EPOCH = 2016

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
  const [epoch, setEpoch] = useState('0')
  const [averageBlockTime, setAverageBlockTime] = useState('unknown')
  const [remainingTime, setRemainingTime] = useState('unknown')

  const [dateStart, setDateStart] = useState('unknown date')
  const [dateEnd, setDateEnd] = useState('unknown date')
  const [heightStart, setHeightStart] = useState('?')
  const [heightEnd, setHeightEnd] = useState('?')

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
    if (loading) return
    setLoading(true)
    try {
      const fileName = getFileName(Number(epoch))
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

      const firstBlock = data[0]
      const lastBlock = data[data.length - 1]

      setHeightStart(firstBlock.height.toString())
      setHeightEnd(lastBlock.height.toString())
      setDateStart(formatDate(firstBlock.timestamp * 1000))
      setDateEnd(formatDate(lastBlock.timestamp * 1000))

      setData(data)
    } catch (error) {
      throw new Error('Failed to fetch data:' + error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [epoch]) // eslint-disable-line react-hooks/exhaustive-deps

  function nextEpoch() {
    setEpoch((Number(epoch) + 1).toString())
  }

  function previousEpoch() {
    setEpoch(Math.max(0, Number(epoch) - 1).toString())
  }

  return (
    <SSMainLayout style={styles.mainContainer}>
      <SSHStack gap="none" justifyBetween style={{ alignItems: 'flex-start' }}>
        <SSVStack gap="none">
          <SSText weight="bold">~{averageBlockTime} minutes</SSText>
          <SSText color="muted" size="xs" style={{ flexShrink: 1 }}>
            Average Block Time (current)
          </SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText weight="bold" style={{ textAlign: 'right' }}>
            {remainingTime}
          </SSText>
          <SSText
            color="muted"
            size="xs"
            style={{ flexShrink: 1, textAlign: 'right' }}
          >
            Next Difficulty Adjustment
          </SSText>
        </SSVStack>
      </SSHStack>
      <View style={styles.canvasContainer}>
        <SSSpiralBlocks
          data={data}
          loading={loading}
          maxBlocksPerSpiral={BLOCKS_PER_EPOCH}
          canvasWidth={CANVAS_WIDTH}
          canvasHeight={CANVAS_HEIGHT}
        />
      </View>
      <SSVStack gap="none">
        <SSVStack gap="none" style={{ justifyContent: 'center', backgroundColor: 'black' }}>
          <SSHStack gap="xs" style={styles.dateContainer}>
            <SSText color="muted">Bitcoin Epoch:</SSText>
            <SSText weight="bold">{epoch}</SSText>
          </SSHStack>
          <SSText center weight="bold">
            {dateStart} - {dateEnd}
          </SSText>
          <SSHStack gap="xs" style={styles.dateContainer}>
            <SSText color="muted">From block</SSText>
            <SSText weight="bold">{heightStart}</SSText>
            <SSText color="muted">to block</SSText>
            <SSText weight="bold">{heightEnd}</SSText>
          </SSHStack>
        </SSVStack>
        <SSHStack justifyBetween>
          <SSActionButton
            style={styles.button}
            onPress={previousEpoch}
            disabled={loading || epoch === '0'}
          >
            <SSIconChevronLeft height={20} width={20} />
          </SSActionButton>
          <SSVStack gap="none" style={styles.inputContainer}>
            <SSNumberInput
              min={0}
              max={400}
              value={epoch}
              onChangeText={setEpoch}
              textAlign="center"
            />
          </SSVStack>
          <SSActionButton
            style={styles.button}
            onPress={nextEpoch}
            disabled={loading}
          >
            <SSIconChevronRight height={20} width={20} />
          </SSActionButton>
        </SSHStack>
      </SSVStack>
    </SSMainLayout>
  )
}

function getFileName(index: number) {
  return `rcp_bitcoin_block_data_${(index * BLOCKS_PER_EPOCH)
    .toString()
    .padStart(7, '0')}.json`
}

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

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 5,
    borderColor: Colors.gray[600],
    padding: 20
  },
  dateContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignContent: 'center',
    alignItems: 'center'
  },
  canvasContainer: {
    marginTop: 120,
    flex: 1
  },
  mainContainer: {
    backgroundColor: Colors.black,
    paddingTop: 10,
    paddingBottom: 20
  }
})

export default ExplorerDifficulty
