import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  type ExplorerBlock,
  fetchExplorerBlock,
  fetchExplorerBlockFromMempool,
  fetchExplorerTipHeight
} from '@/api/explorerBlock'
import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSExploreBlock from '@/components/SSExploreBlock'
import SSExplorerBlockFeeRange from '@/components/SSExplorerBlockFeeRange'
import SSExplorerBlockFeeRateBars from '@/components/SSExplorerBlockFeeRateBars'
import SSExplorerBlockVizStats from '@/components/SSExplorerBlockVizStats'
import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSExplorerSection from '@/components/SSExplorerSection'
import SSExplorerTxSizeBars from '@/components/SSExplorerTxSizeBars'
import SSIconButton from '@/components/SSIconButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import { useExplorerBlockViz } from '@/hooks/useExplorerBlockViz'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Sizes } from '@/styles'
import { saveFile } from '@/utils/filesystem'

const DEFAULT_MAX_BLOCK_HEIGHT = 890_000
const PAGE_PADDING = 120

function ExplorerBlockPage() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const { url: backendUrl, backend, rpcCredentials } = server
  const sourceLabel = `${server.name} (${server.backend})`
  const mempoolOracle = useMempoolOracle(selectedNetwork)

  const { height: windowHeight } = useWindowDimensions()
  const minPageHeight = windowHeight - PAGE_PADDING

  const { height: heightParam } = useLocalSearchParams<{ height?: string }>()

  const [inputHeight, setInputHeight] = useState(heightParam ?? '1')
  const [loading, setLoading] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [maxBlockHeight, setMaxBlockHeight] = useState(DEFAULT_MAX_BLOCK_HEIGHT)
  const [block, setBlock] = useState<ExplorerBlock | null>(null)
  const [metaFromMempool, setMetaFromMempool] = useState(false)

  const heightNumber = Number(inputHeight)
  const atMinHeight = heightNumber <= 1
  const atMaxHeight = heightNumber >= maxBlockHeight
  const displaySourceLabel = metaFromMempool ? 'mempool.space' : sourceLabel
  const showLoadFullMeta = backend === 'electrum' && !metaFromMempool
  const vizHeight = block?.height ?? null
  const {
    data: vizData,
    isError: vizError,
    isLoading: vizLoading,
    loadFromMempool,
    loaded: vizLoaded
  } = useExplorerBlockViz(vizHeight)

  async function loadBlock(height: number) {
    setLoading(true)
    try {
      const nextBlock = await fetchExplorerBlock(
        backendUrl,
        backend,
        height,
        rpcCredentials
      )
      setBlock(nextBlock)
      setMetaFromMempool(false)
      setInputHeight(height.toString())
      return nextBlock
    } catch {
      toast.error(`Failed to fetch block ${height}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadFullMetaFromMempool() {
    const height = Number(inputHeight)
    if (!height) {
      return
    }
    setLoadingMeta(true)
    try {
      const nextBlock = await fetchExplorerBlockFromMempool(
        height,
        mempoolOracle
      )
      setBlock(nextBlock)
      setMetaFromMempool(true)
    } catch {
      toast.error(t('explorer.block.loadFullMetaError'))
    } finally {
      setLoadingMeta(false)
    }
  }

  async function loadLatestBlock() {
    const tipHeight = await fetchExplorerTipHeight(
      backendUrl,
      backend,
      rpcCredentials
    )
    setMaxBlockHeight(tipHeight)
    await loadBlock(tipHeight)
  }

  function fetchBlockFromInput() {
    const height = Number(inputHeight)
    if (height === block?.height || height > maxBlockHeight || height < 0) {
      toast.error('Invalid block height')
      return
    }
    loadBlock(height)
  }

  function nextBlockHeight() {
    setInputHeight(Math.min(maxBlockHeight, Number(inputHeight) + 1).toString())
  }

  function prevBlockHeight() {
    setInputHeight(Math.max(1, Number(inputHeight) - 1).toString())
  }

  async function downloadRawHex() {
    if (!block?.id) {
      return
    }
    setDownloading(true)
    try {
      const raw = await mempoolOracle.getBlockRaw(block.id)
      const hex = Buffer.from(raw).toString('hex')
      await saveFile({
        dialogTitle: t('explorer.block.downloadRawHex'),
        fileContent: hex,
        filename: `block-${block.height}.hex`,
        mimeType: 'text/plain'
      })
    } catch {
      toast.error(t('explorer.block.downloadRawHexError'))
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (heightParam) {
      loadBlock(Number(heightParam))
    } else {
      loadLatestBlock()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('explorer.block.title')}</SSText>
          )
        }}
      />
      <SSMainLayout style={{ paddingBottom: 20, paddingTop: 0 }}>
        <SSVStack justifyBetween style={{ minHeight: minPageHeight }}>
          <SSExploreBlock
            block={block}
            sourceLabel={displaySourceLabel}
            canViewTransactions={Boolean(block?.id)}
          />
          {showLoadFullMeta ? (
            <SSExplorerCapabilityBanner
              why={t('explorer.block.electrumApproximate')}
              fix={t('explorer.block.loadFullMetaNote')}
              onLoad={loadFullMetaFromMempool}
              loadLabel={t('explorer.block.loadFullMeta')}
              loading={loadingMeta}
            />
          ) : null}

          {!vizLoaded ? (
            <SSExplorerCapabilityBanner
              why={t('explorer.block.viz.why')}
              fix={t('explorer.block.viz.fix')}
              onLoad={loadFromMempool}
              loadLabel={t('explorer.block.viz.load')}
              loading={vizLoading}
              disabled={!block?.id}
            />
          ) : null}

          {vizLoaded && vizLoading ? (
            <SSVStack itemsCenter gap="sm">
              <ActivityIndicator color={Colors.white} />
              <SSText size="xs" color="muted">
                {t('common.loadingDots')}
              </SSText>
            </SSVStack>
          ) : null}

          {vizError ? (
            <SSText size="sm" color="muted" center>
              {t('explorer.block.viz.loadError')}
            </SSText>
          ) : null}

          {vizData ? (
            <SSExplorerSection
              title={t('explorer.block.viz.title')}
              source="mempool"
              sourceLabel="mempool.space"
            >
              <SSExplorerBlockFeeRange
                feeRange={vizData.extras.feeRange}
                medianFee={vizData.extras.medianFee}
              />
              <SSExplorerBlockFeeRateBars
                sampleTxs={vizData.sampleTxs}
                totalTxCount={vizData.txCount}
              />
              <SSExplorerTxSizeBars
                sizes={vizData.sampleTxs.map((tx) => tx.weight)}
                totalTxCount={vizData.txCount}
              />
              <SSExplorerBlockVizStats
                extras={vizData.extras}
                txCount={vizData.txCount}
              />
            </SSExplorerSection>
          ) : null}

          <SSVStack gap="sm">
            <SSHStack gap="sm" style={styles.navRow}>
              <SSIconButton
                disabled={atMinHeight}
                style={[
                  styles.navButton,
                  atMinHeight ? styles.navButtonDisabled : null
                ]}
                onPress={prevBlockHeight}
              >
                <SSIconChevronLeft
                  height={18}
                  width={18}
                  stroke={atMinHeight ? Colors.gray[600] : Colors.white}
                />
              </SSIconButton>
              <View style={styles.navInput}>
                <SSNumberInput
                  variant="outline"
                  align="center"
                  min={1}
                  max={maxBlockHeight}
                  value={inputHeight}
                  onChangeText={setInputHeight}
                />
              </View>
              <SSIconButton
                disabled={atMaxHeight}
                style={[
                  styles.navButton,
                  atMaxHeight ? styles.navButtonDisabled : null
                ]}
                onPress={nextBlockHeight}
              >
                <SSIconChevronRight
                  height={18}
                  width={18}
                  stroke={atMaxHeight ? Colors.gray[600] : Colors.white}
                />
              </SSIconButton>
            </SSHStack>
            <SSButton
              variant="outline"
              loading={loading}
              disabled={Number(inputHeight) === block?.height}
              label={t('common.fetch')}
              onPress={fetchBlockFromInput}
            />
            <SSVStack gap="xxs">
              <SSButton
                variant="ghost"
                loading={downloading}
                disabled={!block?.id || downloading}
                label={t('explorer.block.downloadRawHex')}
                onPress={downloadRawHex}
              />
              <SSText size="xxs" center color="muted">
                {t('explorer.block.downloadRawHexSource')}
              </SSText>
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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
  }
})

export default ExplorerBlockPage
