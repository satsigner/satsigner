import { Stack } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
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
import { formatBytes } from '@/utils/format'

const tn = _tn('explorer.mempool')

export default function ExplorerMempool() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const [showExternal, setShowExternal] = useState(false)
  const [showVisualization, setShowVisualization] = useState(false)

  const { data: basicData, isLoading: isLoadingBasic } = useMempoolBasicData()
  const { data: extendedData, isLoading: isLoadingExtended } =
    useMempoolExtendedData(showExternal)

  const feeHistogram = basicData?.feeHistogram ?? []
  const vsizeFromHistogram = basicData?.vsizeFromHistogram ?? 0

  const minFeeRate = feeHistogram.length > 0 ? feeHistogram.at(-1)[0] : null
  const maxFeeRate = feeHistogram.length > 0 ? feeHistogram[0][0] : null

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
          <ActivityIndicator color="white" size="large" />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="xl" style={{ paddingBottom: 32, paddingTop: 20 }}>
          {/* Basic mempool info from Electrum */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('feeHistogram')}
              source={basicData?.source ?? null}
              sourceLabel={
                basicData?.source ? sourceLabel(basicData.source) : null
              }
            />
            <SSVStack gap="xs">
              <Row
                label={tn('mempoolSize')}
                value={
                  vsizeFromHistogram > 0
                    ? formatBytes(vsizeFromHistogram)
                    : '--'
                }
                loading={isLoadingBasic}
              />
              <Row
                label={tn('minFeeRate')}
                value={minFeeRate !== null ? `${minFeeRate} sat/vB` : '--'}
                loading={isLoadingBasic}
              />
              <Row
                label={tn('maxFeeRate')}
                value={maxFeeRate !== null ? `${maxFeeRate} sat/vB` : '--'}
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

          {/* External data opt-in */}
          {!showExternal && (
            <SSVStack style={{ alignItems: 'center' }}>
              <SSButton
                label={tn('loadExternal')}
                variant="outline"
                onPress={() => setShowExternal(true)}
              />
              <SSText size="xs" style={styles.privacyNote}>
                {tn('externalNote')}
              </SSText>
            </SSVStack>
          )}

          {showExternal && (
            <>
              <SSVStack gap="sm">
                <SectionHeader
                  title={tn('mempoolStats')}
                  source="mempool"
                  sourceLabel="mempool.space"
                />
                <SSVStack gap="xs">
                  {extendedData?.count !== undefined &&
                    extendedData.count !== null && (
                      <Row
                        label={tn('pendingTxs')}
                        value={extendedData.count.toLocaleString()}
                        loading={isLoadingExtended}
                      />
                    )}
                  {extendedData?.vsize ? (
                    <Row
                      label={tn('totalVsize')}
                      value={formatBytes(extendedData.vsize)}
                      loading={isLoadingExtended}
                    />
                  ) : null}
                  {extendedData?.totalFee !== undefined &&
                    extendedData.totalFee !== null && (
                      <Row
                        label={tn('totalFees')}
                        value={`${extendedData.totalFee.toLocaleString()} sats`}
                        loading={isLoadingExtended}
                      />
                    )}
                  {extendedData?.fees && (
                    <>
                      <Row
                        label={tn('feeHigh')}
                        value={`${extendedData.fees.high} sat/vB`}
                        loading={isLoadingExtended}
                      />
                      <Row
                        label={tn('feeMedium')}
                        value={`${extendedData.fees.medium} sat/vB`}
                        loading={isLoadingExtended}
                      />
                      <Row
                        label={tn('feeLow')}
                        value={`${extendedData.fees.low} sat/vB`}
                        loading={isLoadingExtended}
                      />
                    </>
                  )}
                  {extendedData?.pendingBlocks && (
                    <Row
                      label={tn('pendingBlocks')}
                      value={extendedData.pendingBlocks.length.toLocaleString()}
                      loading={isLoadingExtended}
                    />
                  )}
                </SSVStack>
              </SSVStack>

              {/* Visualization opt-in */}
              {!showVisualization && extendedData?.pendingBlocks?.length ? (
                <SSVStack style={{ alignItems: 'center' }}>
                  <SSButton
                    label={tn('showVisualization')}
                    variant="outline"
                    onPress={() => setShowVisualization(true)}
                  />
                </SSVStack>
              ) : null}

              {showVisualization && extendedData?.pendingBlocks?.length ? (
                <SSVStack gap="sm">
                  <SSText uppercase size="md" style={styles.sectionTitle}>
                    {tn('pendingBlocksViz')}
                  </SSText>
                  <SSMempoolBlocks blocks={extendedData.pendingBlocks} />
                </SSVStack>
              ) : null}
            </>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
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
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 },
  sourceBackend: { color: Colors.mainGreen, opacity: 0.8 },
  sourceMempool: { color: Colors.gray['500'] },
  valueText: { color: Colors.gray['100'] }
})
