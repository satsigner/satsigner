import { SCREEN_HEIGHT } from '@gorhom/bottom-sheet'
import { Stack } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Dimensions, StyleSheet, useWindowDimensions, View } from 'react-native'

import { MempoolOracle } from '@/api/blockchain'
import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNumberInput from '@/components/SSNumberInput'
import SSSpiralBlocks from '@/components/SSSpiralBlocks'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import {
  type BlockDifficulty,
  type DifficultyAdjustment
} from '@/types/models/Blockchain'
import { formatDate, formatTimeFromNow } from '@/utils/format'

const { width: SCREEN_WIDTH, height: _SCREEN_HEIGHT } = Dimensions.get('window')
const CANVAS_WIDTH = SCREEN_WIDTH
const CANVAS_HEIGHT = 0.7 * SCREEN_HEIGHT
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
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )
  const mempoolOracle = useMemo(
    () => new MempoolOracle(mempoolUrl),
    [mempoolUrl]
  )

  const { width } = useWindowDimensions()

  const [data, setData] = useState<BlockDifficulty[]>([])
  const [loading, setLoading] = useState(false)

  const [epoch, setEpoch] = useState('0')
  // TODO: Update the data source. The latest available epoch from our data
  // source is 426 even though as of March 2025 the epoch is 441.
  const [maxEpoch, _setMaxEpoch] = useState(426)
  const [averageBlockTime, setAverageBlockTime] = useState('?')
  const [remainingTime, setRemainingTime] = useState('?')

  const [dateStart, setDateStart] = useState('?')
  const [dateEnd, setDateEnd] = useState('?')
  const [heightStart, setHeightStart] = useState('?')
  const [heightEnd, setHeightEnd] = useState('?')

  const [modalVisible, setModalVisible] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState({} as BlockDifficulty)

  async function fetchDifficultyAdjustment() {
    const response =
      (await mempoolOracle.getDifficultyAdjustment()) as DifficultyAdjustment

    const tn = _tn('time')

    const avgTimeInSeconds = response.timeAvg / 1000
    const avgTimeInMinutes = avgTimeInSeconds / 60
    const formattedAvgTime = tn('minutes', {
      value: avgTimeInMinutes.toFixed(1)
    })
    setAverageBlockTime(`~${formattedAvgTime}`)

    const [time, timeUnit] = formatTimeFromNow(response.remainingTime)
    const timeFromAdjusment =
      time.toFixed(1) === '1.0'
        ? tn(`${timeUnit}`)
        : tn(`${timeUnit}s`, { value: time.toFixed(4) })
    setRemainingTime(`~${timeFromAdjusment}`)
  }

  useEffect(() => {
    fetchDifficultyAdjustment()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData(epoch: number) {
    if (loading) return
    setLoading(true)
    try {
      const fileName = getFileName(epoch)
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

  async function fetchLatestEpoch() {
    // INFO: this is how we would get the latest epoch:
    // const oracle = new MempoolOracle(url)
    // const blockHeight = await oracle.getCurrentBlockHeight()
    // const latestEpoch = Math.floor(blockHeight / BLOCKS_PER_EPOCH)
    setEpoch(maxEpoch.toString())
    fetchData(maxEpoch)
  }

  useEffect(() => {
    fetchLatestEpoch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function nextEpoch() {
    setEpoch(Math.min(maxEpoch, Number(epoch) + 1).toString())
  }

  function previousEpoch() {
    setEpoch(Math.max(0, Number(epoch) - 1).toString())
  }

  function selectBlock(block: BlockDifficulty) {
    setModalVisible(true)
    setSelectedBlock(block)
  }

  async function fetchEpoch() {
    fetchData(Number(epoch))
  }

  const tn = _tn('explorer.difficulty')

  return (
    <SSMainLayout style={styles.mainContainer}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <SSHStack gap="none" justifyBetween style={styles.headerContainer}>
        <SSVStack gap="none">
          <SSText weight="bold">{averageBlockTime}</SSText>
          <SSText color="muted" size="xs" style={[styles.headerCaption]}>
            {tn('avgBlock')}
          </SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText weight="bold" style={styles.headerRight}>
            {remainingTime}
          </SSText>
          <SSText
            color="muted"
            size="xs"
            style={[styles.headerCaption, styles.headerRight]}
          >
            {tn('nextAdjustment')}
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
          onBlockPress={selectBlock}
        />
      </View>
      <SSVStack gap="none">
        <SSVStack gap="none" style={styles.footerContainer}>
          <SSHStack gap="xs" style={styles.dateContainer}>
            <SSText color="muted">{tn('epoch')}</SSText>
            <SSText weight="bold">{epoch}</SSText>
          </SSHStack>
          <SSText center weight="bold">
            {dateStart} - {dateEnd}
          </SSText>
          <SSHStack gap="xs" style={styles.dateContainer}>
            <SSText color="muted">{tn('blockFrom')}</SSText>
            <SSText weight="bold">{heightStart}</SSText>
            <SSText color="muted">{tn('blockTo')}</SSText>
            <SSText weight="bold">{heightEnd}</SSText>
          </SSHStack>
        </SSVStack>
        <SSHStack justifyBetween>
          <SSActionButton
            style={styles.button}
            onPress={previousEpoch}
            disabled={epoch === '0'}
          >
            <SSIconChevronLeft height={20} width={20} stroke="#fff" />
          </SSActionButton>
          <SSVStack gap="none" style={styles.inputContainer}>
            <SSNumberInput
              min={0}
              max={maxEpoch}
              value={epoch}
              onChangeText={setEpoch}
              textAlign="center"
              style={{ borderWidth: 1, borderColor: '#fff' }}
            />
          </SSVStack>
          <SSActionButton style={styles.button} onPress={nextEpoch}>
            <SSIconChevronRight height={20} width={18} stroke="#fff" />
          </SSActionButton>
        </SSHStack>
        <SSVStack style={{ alignItems: 'center', marginTop: 10 }}>
          <SSButton
            label={tn('fetch')}
            variant="outline"
            onPress={fetchEpoch}
            loading={loading}
          />
        </SSVStack>
      </SSVStack>
      <SSModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <SSVStack style={styles.modalContainer}>
          <BlockDetails block={selectedBlock} />
          <SSButton
            label="close"
            onPress={() => setModalVisible(false)}
            variant="secondary"
            style={{ width: width - 40 }}
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

type BlockDetailsProps = {
  block: BlockDifficulty | null
}

function BlockDetails({ block }: BlockDetailsProps) {
  const { width } = useWindowDimensions()

  if (block === null) {
    return null
  }

  const horizontalPadding = 20 * 2
  const columnStyle = {
    width: (width - horizontalPadding) / 3
  }

  const tn = _tn('explorer.difficulty.blockDetails')

  return (
    <>
      <SSText center uppercase weight="bold">
        {tn('title')}
      </SSText>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('height')}
          </SSText>
          <SSText>{block.height}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('cycleHeight')}
          </SSText>
          <SSText>{block.cycleHeight}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('txs')}
          </SSText>
          <SSText>{block.txCount}</SSText>
        </SSVStack>
      </SSHStack>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('size')}
          </SSText>
          <SSText>{block.size}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('vsize')}
          </SSText>
          <SSText>{Math.trunc(block.weight / 4)}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('weight')}
          </SSText>
          <SSText>{block.weight}</SSText>
        </SSVStack>
      </SSHStack>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('nonce')}
          </SSText>
          <SSText>{block.nonce}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('date')}
          </SSText>
          <SSText>{formatDate(block.timestamp * 1000)}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            {tn('time')}
          </SSText>
          <SSText>{block.timeDifference}s</SSText>
        </SSVStack>
      </SSHStack>
      <SSVStack
        gap="none"
        style={{
          width: width - horizontalPadding
        }}
      >
        <SSText color="muted" uppercase>
          {tn('chainWork')}
        </SSText>
        <SSText>{block.chainWork}</SSText>
      </SSVStack>
    </>
  )
}

function getFileName(index: number) {
  return `rcp_bitcoin_block_data_${(index * BLOCKS_PER_EPOCH)
    .toString()
    .padStart(7, '0')}.json`
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 5,
    borderColor: Colors.white,
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
    marginTop: 140,
    flex: 1
  },
  mainContainer: {
    backgroundColor: Colors.black,
    paddingTop: 10,
    paddingBottom: 20
  },
  modalContainer: {
    zIndex: 120,
    backgroundColor: 'black',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  blockDetailsSection: {
    flexGrow: 1
  },
  blockDetailsSectionGroup: {
    alignItems: 'flex-start',
    gap: 0
  },
  fullWidth: {
    width: '100%',
    textAlign: 'center'
  },
  headerContainer: {
    alignItems: 'flex-start'
  },
  headerCaption: {
    flexShrink: 1
  },
  headerRight: {
    textAlign: 'right'
  },
  footerContainer: {
    justifyContent: 'center'
  }
})

export default ExplorerDifficulty
