import { useQuery } from '@tanstack/react-query'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { Dimensions, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSExplorerSection from '@/components/SSExplorerSection'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSNumberInput from '@/components/SSNumberInput'
import SSSpiralBlocks from '@/components/SSSpiralBlocks'
import SSText from '@/components/SSText'
import { useChainData } from '@/hooks/useChainData'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Sizes } from '@/styles'
import {
  type BlockDifficulty,
  type DifficultyAdjustment
} from '@/types/models/Blockchain'
import {
  formatExplorerBackendSource,
  getExplorerCapability
} from '@/utils/explorerCapabilities'
import { formatDate, formatNumber, formatTimeFromNow } from '@/utils/format'
import { time } from '@/utils/time'

const SCREEN_HEIGHT = Dimensions.get('screen').height
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
  return items.map((value) => ({
    chainWork: value[3].chainwork,
    cycleHeight: value[7].block_in_cycle,
    height: value[0].height,
    nonce: value[4].nonce,
    size: value[5].size,
    timeDifference: value[8].time_difference,
    timestamp: value[1].time,
    txCount: value[2].nTx,
    weight: value[6].weight
  }))
}

function ExplorerDifficulty() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const mempoolOracle = useMempoolOracle(selectedNetwork)
  const { data: chainData } = useChainData()
  const adjustmentCapability = getExplorerCapability(
    server.backend,
    'difficultyAdjustment'
  )

  const { width } = useWindowDimensions()
  const CANVAS_WIDTH = width

  const [inputEpoch, setInputEpoch] = useState(MAX_EPOCH.toString())
  const [fetchedEpoch, setFetchedEpoch] = useState<string | null>(null)
  const [loadAdjustment, setLoadAdjustment] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState<BlockDifficulty | null>(
    null
  )

  const { data: difficultyAdjustment, isLoading: isLoadingAdjustment } =
    useQuery<DifficultyAdjustment>({
      enabled: loadAdjustment,
      queryFn: () => mempoolOracle.getDifficultyAdjustment(),
      queryKey: ['difficulty-adjustment', selectedNetwork],
      staleTime: time.minutes(5)
    })

  const { data: epochData, isLoading } = useQuery<BlockDifficulty[]>({
    enabled: fetchedEpoch !== null,
    queryFn: () => fetchDifficultyEpoch(Number(fetchedEpoch)),
    queryKey: ['difficulty-epoch', fetchedEpoch],
    staleTime: time.infinity
  })

  const data = epochData ?? []
  const [firstBlock] = data
  const lastBlock = data.at(-1)

  const heightStart = firstBlock?.height.toString() ?? '?'
  const heightEnd = lastBlock?.height.toString() ?? '?'
  const dateStart = firstBlock ? formatDate(firstBlock.timestamp * 1000) : '?'
  const dateEnd = lastBlock ? formatDate(lastBlock.timestamp * 1000) : '?'

  const tn = _tn('explorer.difficulty')
  const tnTime = _tn('time')

  const averageBlockTime = difficultyAdjustment
    ? `~${tnTime('minutes', {
        value: (difficultyAdjustment.timeAvg / 1000 / 60).toFixed(1)
      })}`
    : '?'

  const remainingTime = (() => {
    if (!difficultyAdjustment) {
      return '?'
    }
    const [value, timeUnit] = formatTimeFromNow(
      difficultyAdjustment.remainingTime
    )
    if (value.toFixed(1) === '1.0') {
      return `~${tnTime(`${timeUnit}`)}`
    }
    return `~${tnTime(`${timeUnit}s`, { value: value.toFixed(4) })}`
  })()

  const epochNumber = Number(fetchedEpoch ?? inputEpoch)
  const atMinEpoch = epochNumber <= 0
  const atMaxEpoch = epochNumber >= MAX_EPOCH
  const backendSourceLabel = formatExplorerBackendSource(
    server.name,
    server.backend
  )

  function nextEpoch() {
    const next = Math.min(MAX_EPOCH, Number(inputEpoch) + 1).toString()
    setInputEpoch(next)
    setFetchedEpoch(next)
  }

  function previousEpoch() {
    const prev = Math.max(0, Number(inputEpoch) - 1).toString()
    setInputEpoch(prev)
    setFetchedEpoch(prev)
  }

  function fetchEpoch() {
    setFetchedEpoch(inputEpoch)
  }

  function enableAdjustment() {
    setLoadAdjustment(true)
  }

  function selectBlock(block: BlockDifficulty) {
    setModalVisible(true)
    setSelectedBlock(block)
  }

  function closeModal() {
    setModalVisible(false)
  }

  return (
    <SSMainLayout style={styles.mainContainer}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <SSExplorerSection
        title={tn('tipDifficulty')}
        source="backend"
        sourceLabel={backendSourceLabel}
      >
        <SSText weight="bold">
          {chainData?.difficulty ? formatNumber(chainData.difficulty, 2) : '--'}
        </SSText>
        <SSText color="muted" size="xs">
          {tn('tipHeight', {
            height: chainData?.height?.toLocaleString() ?? '--'
          })}
        </SSText>
      </SSExplorerSection>

      {!loadAdjustment ? (
        <SSExplorerCapabilityBanner
          why={t(adjustmentCapability.whyKey!)}
          fix={t(adjustmentCapability.fixKey!)}
          onLoad={enableAdjustment}
          loading={isLoadingAdjustment}
        />
      ) : (
        <SSVStack gap="xs">
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
          <SSText size="xxs" style={[styles.sourceLabel, styles.headerSource]}>
            mempool.space
          </SSText>
        </SSVStack>
      )}

      {fetchedEpoch === null ? (
        <SSVStack gap="sm" style={styles.spiralPrompt}>
          <SSText size="sm" color="muted" center>
            {tn('spiralPrompt')}
          </SSText>
          <SSButton
            variant="outline"
            label={tn('loadSpiral')}
            onPress={fetchEpoch}
          />
          <SSText size="xxs" center color="muted">
            {tn('spiralSource')}
          </SSText>
        </SSVStack>
      ) : (
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
      )}

      <SSVStack gap="none">
        <SSVStack gap="none" style={styles.footerContainer}>
          <SSHStack gap="xs" style={styles.dateContainer}>
            <SSText color="muted">{tn('epoch')}</SSText>
            <SSText weight="bold">{fetchedEpoch ?? inputEpoch}</SSText>
          </SSHStack>
          {fetchedEpoch !== null ? (
            <>
              <SSText center weight="bold">
                {dateStart} - {dateEnd}
              </SSText>
              <SSHStack gap="xs" style={styles.dateContainer}>
                <SSText color="muted">{tn('blockFrom')}</SSText>
                <SSText weight="bold">{heightStart}</SSText>
                <SSText color="muted">{tn('blockTo')}</SSText>
                <SSText weight="bold">{heightEnd}</SSText>
              </SSHStack>
              <SSText size="xxs" center style={styles.sourceLabel}>
                pvxg.net
              </SSText>
            </>
          ) : null}
        </SSVStack>
        <SSVStack gap="sm">
          <SSHStack gap="sm" style={styles.navRow}>
            <SSIconButton
              disabled={atMinEpoch}
              style={[
                styles.navButton,
                atMinEpoch ? styles.navButtonDisabled : null
              ]}
              onPress={previousEpoch}
            >
              <SSIconChevronLeft
                height={18}
                width={18}
                stroke={atMinEpoch ? Colors.gray[600] : Colors.white}
              />
            </SSIconButton>
            <View style={styles.navInput}>
              <SSNumberInput
                variant="outline"
                align="center"
                min={0}
                max={MAX_EPOCH}
                value={inputEpoch}
                onChangeText={setInputEpoch}
              />
            </View>
            <SSIconButton
              disabled={atMaxEpoch}
              style={[
                styles.navButton,
                atMaxEpoch ? styles.navButtonDisabled : null
              ]}
              onPress={nextEpoch}
            >
              <SSIconChevronRight
                height={18}
                width={18}
                stroke={atMaxEpoch ? Colors.gray[600] : Colors.white}
              />
            </SSIconButton>
          </SSHStack>
          <SSButton
            label={tn('fetch')}
            variant="outline"
            onPress={fetchEpoch}
            loading={isLoading}
            disabled={inputEpoch === fetchedEpoch}
          />
        </SSVStack>
      </SSVStack>
      <SSModal visible={modalVisible} onClose={closeModal}>
        <SSVStack style={styles.modalContainer}>
          <BlockDetails block={selectedBlock} onClose={closeModal} />
          <SSButton
            label={t('common.close')}
            onPress={closeModal}
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
  onClose: () => void
}

function BlockDetails({ block, onClose }: BlockDetailsProps) {
  const { width } = useWindowDimensions()

  if (block === null) {
    return null
  }

  const horizontalPadding = 20 * 2
  const columnStyle = {
    width: (width - horizontalPadding) / 3
  }

  const tn = _tn('explorer.difficulty.blockDetails')

  const blockHeight = block.height

  function openBlock() {
    onClose()
    router.push(`/explorer/block/${blockHeight}`)
  }

  return (
    <>
      <SSText center uppercase weight="bold">
        {tn('title')}
      </SSText>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('height')}</SSText>
          <SSText weight="bold">{block.height}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('cycleHeight')}</SSText>
          <SSText weight="bold">{block.cycleHeight}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('date')}</SSText>
          <SSText weight="bold">{formatDate(block.timestamp * 1000)}</SSText>
        </SSVStack>
      </SSHStack>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('txs')}</SSText>
          <SSText weight="bold">{block.txCount}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('size')}</SSText>
          <SSText weight="bold">{block.size}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('weight')}</SSText>
          <SSText weight="bold">{block.weight}</SSText>
        </SSVStack>
      </SSHStack>
      <SSHStack style={styles.blockDetailsSectionGroup}>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('nonce')}</SSText>
          <SSText weight="bold">{block.nonce}</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('time')}</SSText>
          <SSText weight="bold">{block.timeDifference}s</SSText>
        </SSVStack>
        <SSVStack gap="none" style={columnStyle}>
          <SSText color="muted">{tn('vsize')}</SSText>
          <SSText weight="bold">{Math.ceil(block.weight / 4)}</SSText>
        </SSVStack>
      </SSHStack>
      <SSVStack gap="none">
        <SSText color="muted">{tn('chainWork')}</SSText>
        <SSText style={styles.chainWork}>{block.chainWork}</SSText>
      </SSVStack>
      <SSButton
        label={t('explorer.difficulty.viewBlock')}
        onPress={openBlock}
        variant="outline"
        style={{ width: width - 40 }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  blockDetailsSectionGroup: {
    alignItems: 'flex-start',
    gap: 0
  },
  canvasContainer: {
    flex: 1,
    marginTop: 24
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
  headerSource: {
    marginTop: 4,
    textAlign: 'right'
  },
  mainContainer: {
    paddingBottom: 20,
    paddingTop: 10
  },
  modalContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray[950],
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    zIndex: 120
  },
  navButton: {
    alignItems: 'center',
    borderColor: Colors.gray[700],
    borderCurve: 'continuous',
    borderRadius: 8,
    borderWidth: 1,
    height: Sizes.textInput.height.default,
    justifyContent: 'center',
    width: Sizes.textInput.height.default
  },
  navButtonDisabled: {
    borderColor: Colors.gray[800],
    opacity: 0.55
  },
  navInput: {
    flex: 1
  },
  navRow: {
    alignItems: 'center'
  },
  sourceLabel: {
    color: Colors.gray['500'],
    opacity: 0.9
  },
  spiralPrompt: {
    alignItems: 'center',
    marginVertical: 24
  }
})

export default ExplorerDifficulty
