import { SCREEN_HEIGHT } from '@gorhom/bottom-sheet'
import { useEffect, useState } from 'react'
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
import { t } from '@/locales'
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
  const { width } = useWindowDimensions()

  const [data, setData] = useState<BlockDifficulty[]>([])
  const [loading, setLoading] = useState(false)

  const [epoch, setEpoch] = useState('0')
  const [averageBlockTime, setAverageBlockTime] = useState('unknown')
  const [remainingTime, setRemainingTime] = useState('unknown')

  const [dateStart, setDateStart] = useState('unknown date')
  const [dateEnd, setDateEnd] = useState('unknown date')
  const [heightStart, setHeightStart] = useState('?')
  const [heightEnd, setHeightEnd] = useState('?')

  const [modalVisible, setModalVisible] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState({} as BlockDifficulty)

  // function mockFechData() {
  //   const data: BlockDifficulty[] = []
  //   for (let i = 0; i < BLOCKS_PER_EPOCH; i += 1) {
  //     data.push({
  //       height: Number(epoch) * BLOCKS_PER_EPOCH + i,
  //       timestamp: new Date().getTime() / 1000,
  //       txCount: 1000 + Math.trunc(i / 10),
  //       chainWork: '0000000000011',
  //       nonce: Math.trunc(1_000_000_000 * Math.random()),
  //       size: 400 + Math.trunc(400 * Math.random()),
  //       weight: 600 + Math.trunc(600 * Math.random()),
  //       cycleHeight: i + 1,
  //       timeDifference: 500 + Math.trunc(200 * Math.random())
  //     })
  //   }
  //   const firstBlock = data[0]
  //   const lastBlock = data[data.length - 1]
  //   setAverageBlockTime('10.0')
  //   setRemainingTime('~5 days')
  //   setHeightStart(firstBlock.height.toString())
  //   setHeightEnd(lastBlock.height.toString())
  //   setDateStart(formatDate(firstBlock.timestamp * 1000))
  //   setDateEnd(formatDate(lastBlock.timestamp * 1000))
  //   setData(data)
  // }

  async function fetchDifficultyAdjustment() {
    const mempoolOracle = new MempoolOracle()
    const response =
      (await mempoolOracle.getDifficultyAdjustment()) as DifficultyAdjustment

    const avgTimeInSeconds = response.timeAvg / 1000
    const avgTimeInMinutes = avgTimeInSeconds / 60
    const formattedAvgTime = t('time.minutes', {
      value: avgTimeInMinutes.toFixed(1)
    })
    setAverageBlockTime(formattedAvgTime)

    const [time, timeUnit] = formatTimeFromNow(response.remainingTime)
    const timeFromAdjusment =
      time.toFixed(1) === '1.0'
        ? t(`time.${timeUnit}`)
        : t(`time.${timeUnit}s`, { value: time.toFixed(1) })
    setRemainingTime(`~${timeFromAdjusment}`)
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

  function selectBlock(block: BlockDifficulty) {
    setModalVisible(true)
    setSelectedBlock(block)
  }

  return (
    <SSMainLayout style={styles.mainContainer}>
      <SSHStack gap="none" justifyBetween style={styles.headerContainer}>
        <SSVStack gap="none">
          <SSText weight="bold">~{averageBlockTime}</SSText>
          <SSText color="muted" size="xs" style={[styles.headerCaption]}>
            {t('explorer.difficulty.avgBlock')}
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
            {t('explorer.difficulty.nextAdjustment')}
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
            <SSText color="muted">{t('explorer.difficulty.epoch')}</SSText>
            <SSText weight="bold">{epoch}</SSText>
          </SSHStack>
          <SSText center weight="bold">
            {dateStart} - {dateEnd}
          </SSText>
          <SSHStack gap="xs" style={styles.dateContainer}>
            <SSText color="muted">{t('explorer.difficulty.blockFrom')}</SSText>
            <SSText weight="bold">{heightStart}</SSText>
            <SSText color="muted">{t('explorer.difficulty.blockTo')}</SSText>
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

  return (
    <>
      <SSText center uppercase weight="bold">
        BLOCK DETAILS
      </SSText>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Height
          </SSText>
          <SSText>{block.height}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Cycle Height
          </SSText>
          <SSText>{block.cycleHeight}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Transactions
          </SSText>
          <SSText>{block.txCount}</SSText>
        </SSVStack>
      </SSHStack>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Size
          </SSText>
          <SSText>{block.size}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            vBytes
          </SSText>
          <SSText>{Math.trunc(block.weight / 4)}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Weight
          </SSText>
          <SSText>{block.weight}</SSText>
        </SSVStack>
      </SSHStack>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Nonce
          </SSText>
          <SSText>{block.nonce}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Date
          </SSText>
          <SSText>{formatDate(block.timestamp * 1000)}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted" uppercase>
            Time
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
          Chain Work
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
