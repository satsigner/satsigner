import { FlashList } from '@shopify/flash-list'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import { SSIconBubbles, SSIconList } from '@/components/icons'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSDetailsList from '@/components/SSDetailsList'
import SSExplorerAddressTransactions from '@/components/SSExplorerAddressTransactions'
import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSIconButton from '@/components/SSIconButton'
import SSLoader from '@/components/SSLoader'
import SSSeparator from '@/components/SSSeparator'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { getExplorerExampleAddress } from '@/constants/explorerExamples'
import { useExplorerAddress } from '@/hooks/useExplorerAddress'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Layout } from '@/styles'
import type { ExplorerAddressUtxo } from '@/types/explorer/address'
import type { Utxo } from '@/types/models/Utxo'
import { formatExplorerBackendSource } from '@/utils/explorerCapabilities'
import { formatNumber } from '@/utils/format'

const tn = _tn('explorer.address')

const EMPTY_UTXO_SELECTION: Utxo[] = []
const UTXO_BUBBLE_CHART_HEIGHT = 280
const UTXO_LIST_HEIGHT = 220
const TOGGLE_ICON_SIZE = 16
const LOADER_SIZE = 80
const SCREEN_PADDING = 20
const SCREEN_HORIZONTAL_PADDING = SCREEN_PADDING * 2

type UtxoView = 'bubbles' | 'list'

type UtxoRowProps = {
  utxo: ExplorerAddressUtxo
}

function navigateToExplorerTx(txid: string) {
  router.push(`/explorer/transaction/${txid}`)
}

function handleUtxoBubblePress(utxo: Utxo) {
  navigateToExplorerTx(utxo.txid)
}

function toChartUtxos(utxos: ExplorerAddressUtxo[]): Utxo[] {
  return utxos.map((utxo) => ({
    keychain: 'external',
    txid: utxo.txid,
    value: utxo.value,
    vout: utxo.vout
  }))
}

function UtxoRow({ utxo }: UtxoRowProps) {
  function openTx() {
    navigateToExplorerTx(utxo.txid)
  }

  return (
    <Pressable onPress={openTx} style={styles.listItem}>
      <SSText type="mono" size="xs">
        {utxo.txid.slice(0, 12)}…:{utxo.vout}
      </SSText>
      <SSText size="sm">
        {formatNumber(utxo.value)} {t('bitcoin.sats')}
      </SSText>
    </Pressable>
  )
}

function renderUtxo({ item }: { item: ExplorerAddressUtxo }) {
  return <UtxoRow utxo={item} />
}

function utxoKey(item: ExplorerAddressUtxo) {
  return `${item.txid}:${item.vout}`
}

function resolveAddressParam(
  address: string | string[] | undefined
): string | null {
  const raw = Array.isArray(address) ? address[0] : address
  if (!raw) {
    return null
  }
  try {
    return decodeURIComponent(raw).trim()
  } catch {
    return raw.trim()
  }
}

export default function ExplorerAddressDetail() {
  const { address: addressParam } = useLocalSearchParams<{
    address: string
  }>()
  const resolvedAddress = resolveAddressParam(addressParam)
  const example = getExplorerExampleAddress(resolvedAddress)
  const { width: windowWidth } = useWindowDimensions()
  const [utxoView, setUtxoView] = useState<UtxoView>('bubbles')

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const sourceLabel = `${server.name} (${server.backend})`

  const { data, isLoading, isError, capability, loadFromMempool, useMempool } =
    useExplorerAddress(resolvedAddress)

  const displaySourceLabel = useMempool
    ? 'mempool.space'
    : data
      ? formatExplorerBackendSource(server.name, server.backend)
      : sourceLabel

  const totalBalance = data ? data.confirmed + data.unconfirmed : 0
  const chartUtxos = data ? toChartUtxos(data.utxos) : []
  const bubbleCanvasWidth = Math.max(0, windowWidth - SCREEN_HORIZONTAL_PADDING)

  function toggleUtxoView() {
    setUtxoView((prev) => (prev === 'list' ? 'bubbles' : 'list'))
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
      <SSVStack style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <SSLoader size={LOADER_SIZE} />
          </View>
        ) : null}

        {isError && !isLoading ? (
          <SSVStack gap="sm" style={styles.errorContainer} widthFull>
            <SSText color="muted" center>
              {useMempool ? tn('mempoolLoadError') : tn('notFound')}
            </SSText>
            {!useMempool ? (
              <>
                <SSText
                  size="xxs"
                  type="mono"
                  center
                  style={styles.sourceLabel}
                >
                  {sourceLabel}
                </SSText>
                <SSText size="xxs" type="mono" center style={styles.serverUrl}>
                  {server.url}
                </SSText>
                <SSExplorerCapabilityBanner
                  why={capability.whyKey ? t(capability.whyKey) : tn('loadWhy')}
                  fix={capability.fixKey ? t(capability.fixKey) : tn('loadFix')}
                  onLoad={loadFromMempool}
                  loading={isLoading}
                />
              </>
            ) : null}
          </SSVStack>
        ) : null}

        {data ? (
          <>
            <SSVStack gap="none" style={styles.header}>
              <SSVStack gap="xs" style={styles.headerAmount}>
                <SSHStack gap="xs" style={styles.headerAmountRow}>
                  <SSStyledSatText
                    amount={totalBalance}
                    decimals={0}
                    noColor
                    weight="light"
                  />
                  <SSText color="muted">{t('bitcoin.sats')}</SSText>
                </SSHStack>
              </SSVStack>
              <SSHStack gap="xs">
                <SSText>
                  {data.utxos.length}{' '}
                  {data.utxos.length === 1
                    ? t('bitcoin.utxo').toLowerCase()
                    : t('bitcoin.utxos').toLowerCase()}
                </SSText>
                <SSText color="muted">·</SSText>
                <SSText>
                  {data.txids.length}{' '}
                  {data.txids.length === 1
                    ? t('bitcoin.transaction').toLowerCase()
                    : t('bitcoin.transactions').toLowerCase()}
                </SSText>
              </SSHStack>
            </SSVStack>

            <SSDetailsList
              columns={2}
              headerSize="sm"
              textSize="md"
              uppercase={false}
              items={[
                [
                  tn('confirmed'),
                  `${formatNumber(data.confirmed)} ${t('bitcoin.sats')}`
                ],
                [
                  tn('unconfirmed'),
                  `${formatNumber(data.unconfirmed)} ${t('bitcoin.sats')}`
                ],
                [tn('utxoCount'), data.utxos.length.toString()],
                [tn('txCount'), data.txids.length.toString()]
              ]}
            />

            <SSSeparator color="gradient" />

            <SSHStack justifyBetween style={styles.addressSection}>
              <SSVStack gap="sm" style={styles.addressContent}>
                <SSText uppercase color="muted">
                  {tn('address')}
                </SSText>
                <SSClipboardCopy text={data.address} fullWidth>
                  <SSText type="mono" size="xs">
                    {data.address}
                  </SSText>
                </SSClipboardCopy>
                <SSText
                  size="xxs"
                  style={
                    useMempool ? styles.externalSource : styles.sourceLabel
                  }
                >
                  {displaySourceLabel}
                </SSText>
              </SSVStack>
            </SSHStack>

            <SSSeparator color="gradient" />

            <SSVStack gap="sm" style={styles.sectionWithTopPadding}>
              <SSHStack justifyBetween>
                <SSText size="lg">{tn('utxos')}</SSText>
                {data.utxos.length > 0 ? (
                  <SSIconButton onPress={toggleUtxoView}>
                    {utxoView === 'list' ? (
                      <SSIconBubbles
                        height={TOGGLE_ICON_SIZE}
                        width={TOGGLE_ICON_SIZE}
                      />
                    ) : (
                      <SSIconList
                        height={TOGGLE_ICON_SIZE}
                        width={TOGGLE_ICON_SIZE}
                      />
                    )}
                  </SSIconButton>
                ) : null}
              </SSHStack>

              {data.utxos.length === 0 ? (
                <SSText color="muted" size="sm">
                  {tn('noUtxos')}
                </SSText>
              ) : utxoView === 'bubbles' ? (
                <GestureHandlerRootView style={styles.bubbleChart}>
                  <SSBubbleChart
                    utxos={chartUtxos}
                    canvasSize={{
                      height: UTXO_BUBBLE_CHART_HEIGHT,
                      width: bubbleCanvasWidth
                    }}
                    inputs={EMPTY_UTXO_SELECTION}
                    onPress={handleUtxoBubblePress}
                  />
                </GestureHandlerRootView>
              ) : (
                <SSVStack style={styles.listBox}>
                  <FlashList
                    data={data.utxos}
                    keyExtractor={utxoKey}
                    renderItem={renderUtxo}
                  />
                </SSVStack>
              )}
            </SSVStack>

            <SSExplorerAddressTransactions
              address={data.address}
              txids={data.txids}
              preferMempool={useMempool}
            />
          </>
        ) : null}
      </SSVStack>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  addressContent: { flex: 1 },
  addressSection: { alignItems: 'flex-start' },
  bubbleChart: {
    height: UTXO_BUBBLE_CHART_HEIGHT,
    width: '100%'
  },
  container: {
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: SCREEN_PADDING
  },
  errorContainer: {
    alignItems: 'stretch',
    gap: Layout.vStack.gap.md,
    paddingVertical: 60,
    width: '100%'
  },
  externalSource: { color: Colors.gray[500] },
  header: { alignItems: 'center' },
  headerAmount: { alignItems: 'center', marginTop: Layout.vStack.gap.md },
  headerAmountRow: { alignItems: 'baseline', width: 'auto' },
  headerTitle: { alignItems: 'center' },
  listBox: {
    height: UTXO_LIST_HEIGHT
  },
  listItem: {
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    gap: 4,
    paddingVertical: 10
  },
  loadingContainer: {
    alignItems: 'center',
    gap: Layout.vStack.gap.md,
    paddingVertical: 60
  },
  sectionWithTopPadding: { paddingTop: 24 },
  serverUrl: { color: Colors.gray[500], opacity: 0.9 },
  sourceLabel: { color: Colors.mainGreen, opacity: 0.8 }
})
