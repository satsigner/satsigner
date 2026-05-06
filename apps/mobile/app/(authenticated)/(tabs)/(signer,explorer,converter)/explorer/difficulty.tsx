import { SCREEN_HEIGHT } from '@gorhom/bottom-sheet'
import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSNumberInput from '@/components/SSNumberInput'
import SSSpiralBlocks from '@/components/SSSpiralBlocks'
import SSText from '@/components/SSText'
import useMempoolOracle from '@/hooks/useMempoolOracle'
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
import { time } from '@/utils/time'

const CANVAS_HEIGHT = 0.7 * SCREEN_HEIGHT
const BLOCKS_PER_EPOCH = 2016

const DATA_LINK = 'https://pvxg.net/bitcoin_data/difficulty_epochs/'
const MAX_EPOCH = 426

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

async function fetchDifficultyEpoch(epoch: number): Promise<BlockDifficulty[]> {
  const fileName = `rcp_bitcoin_block_data_${(epoch * BLOCKS_PER_EPOCH)
    .toString()
    .padStart(7, '0')}.json`
  const response = await fetch(DATA_LINK + fileName)
  const rawData = (await response.json()) as DifficultyEpochsData[][]
  const [items] = rawData
  return items.map(
    (value) =>
      ({
        chainWork: value[3].chainwork,
        cycleHeight: value[7].block_in_cycle,
        height: value[0].height,
        nonce: value[4].nonce,
        size: value[5].size,
        timeDifference: value[8].time_difference,
        timestamp: value[1].time,
        txCount: value[2].nTx,
        weight: value[6].weight
      }) as BlockDifficulty
  )
}

function ExplorerDifficulty() {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const mempoolOracle = useMempoolOracle()

  const { width } = useWindowDimensions()
  const CANVAS_WIDTH = width

  const [inputEpoch, setInputEpoch] = useState(MAX_EPOCH.toString())
  const [fetchedEpoch, setFetchedEpoch] = useState(MAX_EPOCH.toString())
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState({} as BlockDifficulty)

  const { data: difficultyAdjustment } = useQuery<DifficultyAdjustment>({
    queryFn: () => mempoolOracle.getDifficultyAdjustment(),
    queryKey: ['difficulty-adjustment', selectedNetwork],
    staleTime: time.minutes(5)
  })

  const { data: epochData, isLoading } = useQuery<BlockDifficulty[]>({
    queryFn: () => fetchDifficultyEpoch(Number(fetchedEpoch)),
    queryKey: ['difficulty-epoch', fetchedEpoch],
    staleTime: time.infinity
  })

  const epoch = fetchedEpoch

  const data = epochData ?? []

  const [firstBlock] = data
  const lastBlock = data.at(-1)

  const heightStart = firstBlock?.height.toString() ?? '?'
  const heightEnd = lastBlock?.height.toString() ?? '?'
  const dateStart = firstBlock ? formatDate(firstBlock.timestamp * 1000) : '?'
  const dateEnd = lastBlock ? formatDate(lastBlock.timestamp * 1000) : '?'

  const tn = _tn('explorer.difficulty')
  const tnTime = _tn('time')

  const averageBlockTime = (() => {
    if (!difficultyAdjustment) {
      return '?'
    }
    const avgTimeInMinutes = difficultyAdjustment.timeAvg / 1000 / 60
    return `~${tnTime('minutes', { value: avgTimeInMinutes.toFixed(1) })}`
  })()

  const remainingTime = (() => {
    if (!difficultyAdjustment) {
      return '?'
    }
    const [t, timeUnit] = formatTimeFromNow(difficultyAdjustment.remainingTime)
    return `~${
      t.toFixed(1) === '1.0'
        ? tnTime(`${timeUnit}`)
        : tnTime(`${timeUnit}s`, { value: t.toFixed(4) })
    }`
  })()

  function nextEpoch() {
    const next = Math.min(MAX_EPOCH, Number(fetchedEpoch) + 1).toString()
    setInputEpoch(next)
    setFetchedEpoch(next)
  }

  function previousEpoch() {
    const prev = Math.max(0, Number(fetchedEpoch) - 1).toString()
    setInputEpoch(prev)
    setFetchedEpoch(prev)
  }

  function fetchEpoch() {
    setFetchedEpoch(inputEpoch)
  }

  function selectBlock(block: BlockDifficulty) {
    setModalVisible(true)
    setSelectedBlock(block)
  }

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
          <SSText color="muted" size="xs" style={styles.headerCaption}>
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
          loading={isLoading}
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
            disabled={fetchedEpoch === '0'}
          >
            <SSIconChevronLeft height={20} width={20} stroke="#fff" />
          </SSActionButton>
          <SSVStack gap="none" style={styles.inputContainer}>
            <SSNumberInput
              min={0}
              max={MAX_EPOCH}
              value={inputEpoch}
              onChangeText={setInputEpoch}
              textAlign="center"
              style={{ borderColor: '#fff', borderWidth: 1 }}
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
            loading={isLoading}
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
      <SSVStack gap="none" style={{ width: width - horizontalPadding }}>
        <SSText color="muted" uppercase>
          {tn('chainWork')}
        </SSText>
        <SSText style={styles.chainWork}>{block.chainWork}</SSText>
      </SSVStack>
    </>
  )
}

const styles = StyleSheet.create({
  blockDetailsSectionGroup: {
    alignItems: 'flex-start',
    gap: 0
  },
  button: {
    borderColor: Colors.white,
    borderRadius: 5,
    borderWidth: 1,
    padding: 20
  },
  canvasContainer: {
    flex: 1,
    marginTop: 140
  },
  chainWork: {
    color: Colors.gray['100'],
    fontFamily: 'monospace'
  },
  dateContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  footerContainer: {
    justifyContent: 'center'
  },
  headerCaption: {
    flexShrink: 1
  },
  headerContainer: {
    alignItems: 'flex-start'
  },
  headerRight: {
    textAlign: 'right'
  },
  inputContainer: {
    alignContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center'
  },
  mainContainer: {
    backgroundColor: Colors.black,
    paddingBottom: 20,
    paddingTop: 10
  },
  modalContainer: {
    alignItems: 'center',
    backgroundColor: 'black',
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    zIndex: 120
  }
})

export default ExplorerDifficulty
