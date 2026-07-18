import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import {
  fetchExplorerBlockRawHex,
  fetchExplorerBlockRawHexFromMempool
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
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import { getExplorerExampleBlock } from '@/constants/explorerExamples'
import { useExplorerBlock } from '@/hooks/useExplorerBlock'
import { useExplorerBlockViz } from '@/hooks/useExplorerBlockViz'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Sizes } from '@/styles'
import {
  formatExplorerBackendSource,
  getExplorerCapability
} from '@/utils/explorerCapabilities'
import { saveFile } from '@/utils/filesystem'

const tn = _tn('explorer.block')

const LOADER_SIZE = 80
const HEX_HASH_LENGTH = 64
const HEX_REGEX = /^[0-9a-f]+$/i

function resolveHeightParam(
  block: string | string[] | undefined
): number | null {
  const raw = Array.isArray(block) ? block[0] : block
  if (!raw) {
    return null
  }
  if (raw.length === HEX_HASH_LENGTH && HEX_REGEX.test(raw)) {
    return null
  }
  const height = Number(raw)
  if (!Number.isInteger(height) || height < 0) {
    return null
  }
  return height
}

export default function ExplorerBlockDetail() {
  const router = useRouter()
  const { block: blockParam } = useLocalSearchParams<{ block: string }>()
  const height = resolveHeightParam(blockParam)
  const example = getExplorerExampleBlock(height)

  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const mempoolOracle = useMempoolOracle(selectedNetwork)
  const [loadingHex, setLoadingHex] = useState(false)

  const {
    data: block,
    isError,
    isLoading,
    isFetching,
    loadFromMempool,
    maxBlockHeight,
    server,
    useMempool
  } = useExplorerBlock(height)

  const sourceLabel = formatExplorerBackendSource(server.name, server.backend)
  const displaySourceLabel = useMempool ? 'mempool.space' : sourceLabel
  const showLoadFullMeta = server.backend === 'electrum' && !useMempool
  const rawBlockCapability = getExplorerCapability(server.backend, 'rawBlock')

  const vizHeight = block?.height ?? null
  const {
    data: vizData,
    isError: vizError,
    isLoading: vizLoading,
    loadFromMempool: loadVizFromMempool,
    loaded: vizLoaded
  } = useExplorerBlockViz(vizHeight)

  const atMinHeight = height !== null && height <= 0
  const atMaxHeight =
    height !== null && maxBlockHeight !== null && height >= maxBlockHeight

  function goToHeight(nextHeight: number) {
    router.replace(`/explorer/block/${nextHeight}`)
  }

  function prevBlock() {
    if (height === null || atMinHeight) {
      return
    }
    goToHeight(height - 1)
  }

  function nextBlock() {
    if (height === null || atMaxHeight) {
      return
    }
    goToHeight(height + 1)
  }

  function handleViewHex() {
    if (!block?.id) {
      return
    }
    router.push(`/explorer/block/${block.id}/hex`)
  }

  async function saveBlockHex(hex: string, height: number) {
    await saveFile({
      dialogTitle: tn('downloadRawHex'),
      fileContent: hex,
      filename: `block-${height}.hex`,
      mimeType: 'text/plain'
    })
  }

  async function handleDownloadHex() {
    if (!block?.id || !rawBlockCapability.available) {
      return
    }
    setLoadingHex(true)
    try {
      const { hex } = await fetchExplorerBlockRawHex(
        block.id,
        server.url,
        server.backend,
        server.rpcCredentials
      )
      await saveBlockHex(hex, block.height)
    } catch {
      toast.error(tn('downloadRawHexError'))
    } finally {
      setLoadingHex(false)
    }
  }

  async function handleDownloadHexFromMempool() {
    if (!block?.id) {
      return
    }
    setLoadingHex(true)
    try {
      const { hex } = await fetchExplorerBlockRawHexFromMempool(
        block.id,
        mempoolOracle
      )
      await saveBlockHex(hex, block.height)
    } catch {
      toast.error(tn('downloadRawHexError'))
    } finally {
      setLoadingHex(false)
    }
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSVStack gap="none" style={styles.headerTitle}>
              {example ? (
                <SSText
                  size="xs"
                  color="muted"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {example.label}
                </SSText>
              ) : null}
              <SSText uppercase numberOfLines={1} adjustsFontSizeToFit>
                {tn('detailsTitle')}
              </SSText>
            </SSVStack>
          )
        }}
      />
      <SSMainLayout style={styles.container}>
        {height === null ? (
          <SSText color="muted" center>
            {tn('invalid')}
          </SSText>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <SSLoader size={LOADER_SIZE} />
          </View>
        ) : null}

        {isError && !isLoading ? (
          <SSVStack gap="sm" style={styles.errorContainer}>
            <SSText color="muted" center>
              {tn('notFound')}
            </SSText>
            <SSText size="xxs" type="mono" center>
              {sourceLabel}
            </SSText>
            <SSText size="xxs" type="mono" center>
              {server.url}
            </SSText>
            <SSExplorerCapabilityBanner
              why={tn('electrumApproximate')}
              fix={tn('loadFullMetaNote')}
              onLoad={loadFromMempool}
              loadLabel={tn('loadFullMeta')}
              loading={isLoading}
            />
          </SSVStack>
        ) : null}

        {block && !isLoading ? (
          <SSVStack gap="md">
            <SSExploreBlock
              block={block}
              sourceLabel={displaySourceLabel}
              canViewTransactions={Boolean(block.id)}
            />
            {showLoadFullMeta ? (
              <SSExplorerCapabilityBanner
                why={tn('electrumApproximate')}
                fix={tn('loadFullMetaNote')}
                onLoad={loadFromMempool}
                loadLabel={tn('loadFullMeta')}
                loading={isFetching}
              />
            ) : null}

            {!vizLoaded ? (
              <SSExplorerCapabilityBanner
                why={tn('viz.why')}
                fix={tn('viz.fix')}
                onLoad={loadVizFromMempool}
                loadLabel={tn('viz.load')}
                loading={vizLoading}
                disabled={!block.id}
              />
            ) : null}

            {vizLoaded && vizLoading ? (
              <View style={styles.loadingContainer}>
                <SSLoader size={LOADER_SIZE} />
              </View>
            ) : null}

            {vizError ? (
              <SSText size="sm" color="muted" center>
                {tn('viz.loadError')}
              </SSText>
            ) : null}

            {vizData ? (
              <SSExplorerSection
                title={tn('viz.title')}
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
                  onPress={prevBlock}
                >
                  <SSIconChevronLeft
                    height={18}
                    width={18}
                    stroke={atMinHeight ? Colors.gray[600] : Colors.white}
                  />
                </SSIconButton>
                <View style={styles.navHeight}>
                  <SSText center size="lg">
                    {block.height}
                  </SSText>
                </View>
                <SSIconButton
                  disabled={atMaxHeight}
                  style={[
                    styles.navButton,
                    atMaxHeight ? styles.navButtonDisabled : null
                  ]}
                  onPress={nextBlock}
                >
                  <SSIconChevronRight
                    height={18}
                    width={18}
                    stroke={atMaxHeight ? Colors.gray[600] : Colors.white}
                  />
                </SSIconButton>
              </SSHStack>
              <SSVStack gap="xxs">
                {rawBlockCapability.available ? (
                  <>
                    <SSHStack gap="sm">
                      <SSButton
                        variant="ghost"
                        disabled={!block.id}
                        label={tn('viewHex')}
                        onPress={handleViewHex}
                        style={styles.hexActionButton}
                      />
                      <SSButton
                        variant="ghost"
                        loading={loadingHex}
                        disabled={!block.id || loadingHex}
                        label={tn('downloadRawHex')}
                        onPress={handleDownloadHex}
                        style={styles.hexActionButton}
                      />
                    </SSHStack>
                    <SSText size="xxs" center color="muted">
                      {tn('downloadRawHexSource', {
                        source: sourceLabel
                      })}
                    </SSText>
                  </>
                ) : (
                  <>
                    <SSButton
                      variant="ghost"
                      disabled={!block.id}
                      label={tn('viewHex')}
                      onPress={handleViewHex}
                    />
                    <SSExplorerCapabilityBanner
                      why={t(
                        rawBlockCapability.whyKey ??
                          'explorer.capability.rawBlock.electrum.why'
                      )}
                      fix={t(
                        rawBlockCapability.fixKey ??
                          'explorer.capability.rawBlock.electrum.fix'
                      )}
                      onLoad={handleDownloadHexFromMempool}
                      loadLabel={tn('downloadRawHex')}
                      loading={loadingHex}
                      disabled={!block.id}
                    />
                  </>
                )}
              </SSVStack>
            </SSVStack>
          </SSVStack>
        ) : null}
      </SSMainLayout>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
    paddingTop: 0
  },
  errorContainer: {
    paddingVertical: 40
  },
  headerTitle: {
    alignItems: 'center',
    maxWidth: 240
  },
  hexActionButton: {
    flex: 1
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 60
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
  navHeight: {
    flex: 1,
    justifyContent: 'center'
  },
  navRow: {
    alignItems: 'center'
  }
})
