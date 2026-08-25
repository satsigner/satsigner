import { Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSLoader from '@/components/SSLoader'
import SSMempoolBlocks from '@/components/SSMempoolBlocks'
import SSText from '@/components/SSText'
import {
  useMempoolBasicData,
  useMempoolExtendedData
} from '@/hooks/useMempoolData'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import type { MemPoolFees } from '@/types/models/Blockchain'
import { formatBytes } from '@/utils/format'

const tn = _tn('explorer.mempool')

export default function ExplorerMempool() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const [showExternal, setShowExternal] = useState(false)

  const { data: basicData, isLoading: isLoadingBasic } = useMempoolBasicData()
  const { data: extendedData, isLoading: isLoadingExtended } =
    useMempoolExtendedData(showExternal)

  const feeHistogram = basicData?.feeHistogram ?? []
  const vsizeFromHistogram = basicData?.vsizeFromHistogram ?? 0
  const backendVsize = basicData?.vsize ?? vsizeFromHistogram
  const backendFees = basicData?.fees ?? null
  const backendProjectedBlocks = basicData?.projectedBlocks ?? []

  const minFeeRate =
    basicData?.minFeeRate ??
    (feeHistogram.length > 0 ? (feeHistogram.at(-1)?.[0] ?? null) : null)
  const maxFeeRate = feeHistogram.length > 0 ? feeHistogram[0]?.[0] : null

  function enableExternal() {
    setShowExternal(true)
  }

  function sourceLabel(src: 'backend' | 'mempool') {
    return src === 'backend'
      ? `${server.name} (${server.backend})`
      : 'mempool.space'
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      {isLoadingBasic && (
        <View style={styles.loadingContainer}>
          <SSLoader size={80} />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="xl" style={{ paddingBottom: 32, paddingTop: 20 }}>
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('mempoolStats')}
              source={basicData?.source ?? null}
              sourceLabel={
                basicData?.source ? sourceLabel(basicData.source) : null
              }
            />
            <SSVStack gap="xs">
              {basicData?.count !== null && basicData?.count !== undefined ? (
                <Row
                  label={tn('pendingTxs')}
                  value={basicData.count.toLocaleString()}
                  loading={isLoadingBasic}
                />
              ) : null}
              <Row
                label={tn('mempoolSize')}
                value={
                  backendVsize && backendVsize > 0
                    ? formatBytes(backendVsize)
                    : '--'
                }
                loading={isLoadingBasic}
              />
              {basicData?.totalFee !== null &&
              basicData?.totalFee !== undefined ? (
                <Row
                  label={tn('totalFees')}
                  value={`${basicData.totalFee.toLocaleString()} sats`}
                  loading={isLoadingBasic}
                />
              ) : null}
              <Row
                label={tn('minFeeRate')}
                value={
                  minFeeRate !== null
                    ? `${Math.round(minFeeRate)} sat/vB`
                    : '--'
                }
                loading={isLoadingBasic}
              />
              <Row
                label={tn('maxFeeRate')}
                value={
                  maxFeeRate !== null
                    ? `${Math.round(maxFeeRate)} sat/vB`
                    : '--'
                }
                loading={isLoadingBasic}
              />
              <Row
                label={tn('feeBands')}
                value={
                  feeHistogram.length > 0
                    ? feeHistogram.length.toString()
                    : '--'
                }
                loading={isLoadingBasic}
              />
            </SSVStack>
          </SSVStack>

          {backendFees ? (
            <SSVStack gap="sm">
              <SectionHeader
                title={tn('feeRecommendations')}
                source="backend"
                sourceLabel={sourceLabel('backend')}
              />
              <FeeRows fees={backendFees} loading={isLoadingBasic} />
            </SSVStack>
          ) : null}

          {!showExternal && backendProjectedBlocks.length > 0 ? (
            <SSVStack gap="sm">
              <SectionHeader
                title={tn('pendingBlocks')}
                source="backend"
                sourceLabel={sourceLabel('backend')}
              />
              <SSMempoolBlocks blocks={backendProjectedBlocks} approximate />
            </SSVStack>
          ) : null}

          {!showExternal ? (
            <SSExplorerCapabilityBanner
              why={tn('externalWhy')}
              fix={tn('externalNote')}
              onLoad={enableExternal}
              loadLabel={tn('loadExternal')}
              loading={isLoadingExtended}
            />
          ) : null}

          {showExternal ? (
            <>
              <SSVStack gap="sm">
                <SectionHeader
                  title={tn('feeRecommendations')}
                  source="mempool"
                  sourceLabel="mempool.space"
                />
                {isLoadingExtended ? (
                  <View style={styles.sectionLoading}>
                    <SSLoader size={48} />
                  </View>
                ) : extendedData?.fees ? (
                  <FeeRows fees={extendedData.fees} loading={false} />
                ) : (
                  <SSText size="sm" color="muted">
                    {tn('feeRecommendationsEmpty')}
                  </SSText>
                )}
              </SSVStack>

              <SSVStack gap="sm">
                <SectionHeader
                  title={tn('pendingBlocks')}
                  source="mempool"
                  sourceLabel="mempool.space"
                />
                {isLoadingExtended ? (
                  <View style={styles.sectionLoading}>
                    <SSLoader size={48} />
                  </View>
                ) : extendedData?.pendingBlocks?.length ? (
                  <SSMempoolBlocks blocks={extendedData.pendingBlocks} />
                ) : (
                  <SSText size="sm" color="muted">
                    {tn('pendingBlocksEmpty')}
                  </SSText>
                )}
              </SSVStack>
            </>
          ) : null}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

function FeeRows({ fees, loading }: { fees: MemPoolFees; loading: boolean }) {
  return (
    <SSVStack gap="xs">
      <Row
        label={tn('feeHigh')}
        value={`${Math.round(fees.high)} sat/vB`}
        loading={loading}
      />
      <Row
        label={tn('feeMedium')}
        value={`${Math.round(fees.medium)} sat/vB`}
        loading={loading}
      />
      <Row
        label={tn('feeLow')}
        value={`${Math.round(fees.low)} sat/vB`}
        loading={loading}
      />
    </SSVStack>
  )
}

function SectionHeader({
  title,
  source,
  sourceLabel
}: {
  title: string
  source: string | null
  sourceLabel: string | null
}) {
  return (
    <SSHStack justifyBetween style={{ alignItems: 'center' }}>
      <SSText uppercase size="md" style={styles.sectionTitle}>
        {title}
      </SSText>
      {source && sourceLabel && (
        <SSText
          size="xxs"
          style={
            source === 'backend' ? styles.sourceBackend : styles.sourceMempool
          }
        >
          {sourceLabel}
        </SSText>
      )}
    </SSHStack>
  )
}

function Row({
  label,
  value,
  loading
}: {
  label: string
  value: string
  loading: boolean
}) {
  return (
    <SSHStack justifyBetween style={styles.row}>
      <SSText size="sm" style={styles.labelText}>
        {label}
      </SSText>
      <SSText size="sm" style={styles.valueText}>
        {loading ? '--' : value}
      </SSText>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  labelText: { color: Colors.gray['400'] },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  privacyNote: { color: Colors.gray['600'], marginTop: 4, textAlign: 'center' },
  row: { alignItems: 'center', paddingVertical: 4 },
  sectionLoading: { alignItems: 'center', paddingVertical: 24 },
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 },
  sourceBackend: { color: Colors.mainGreen, opacity: 0.8 },
  sourceMempool: { color: Colors.gray['500'] },
  valueText: { color: Colors.gray['100'] }
})
