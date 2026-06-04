import { useQuery } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { useChainData } from '@/hooks/useChainData'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import type { DifficultyAdjustment } from '@/types/models/Blockchain'
import {
  blocksUntilDifficultyAdjustment,
  difficultyEpoch,
  estimatedDifficultyAdjustmentDate,
  estimatedHashRateEHs
} from '@/utils/bitcoin/consensus'
import { formatDate } from '@/utils/format'
import { time } from '@/utils/time'

const tn = _tn('explorer.chain')

export default function ExplorerChain() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const oracle = useMempoolOracle(selectedNetwork)
  const [showExternal, setShowExternal] = useState(false)

  const { data: chainData, isLoading } = useChainData()

  const { data: difficultyAdjustment, isLoading: isLoadingAdj } =
    useQuery<DifficultyAdjustment>({
      enabled: showExternal,
      queryFn: () => oracle.getDifficultyAdjustment(),
      queryKey: ['chain-difficulty-adjustment', selectedNetwork],
      staleTime: time.minutes(5)
    })

  const height = chainData?.height ?? null
  const difficulty = chainData?.difficulty ?? null

  const blocksInEpoch = height !== null ? height % 2016 : null
  const blocksUntilAdj =
    height !== null ? blocksUntilDifficultyAdjustment(height) : null
  const epoch = height !== null ? difficultyEpoch(height) : null
  const estAdjDate =
    height !== null ? estimatedDifficultyAdjustmentDate(height) : null
  const estHashRate =
    difficulty !== null ? estimatedHashRateEHs(difficulty) : null

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
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="white" size="large" />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="xl" style={{ paddingBottom: 32, paddingTop: 20 }}>
          {/* Latest Block — from backend */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('latestBlock')}
              source={chainData?.source ?? null}
              sourceLabel={
                chainData?.source ? sourceLabel(chainData.source) : null
              }
            />
            <SSVStack gap="xs">
              <Row
                label={tn('height')}
                value={height?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('timestamp')}
                value={
                  chainData?.timestamp
                    ? formatDate(chainData.timestamp * 1000)
                    : '--'
                }
                loading={isLoading}
              />
              <Row
                label={tn('difficulty')}
                value={
                  difficulty?.toLocaleString(undefined, {
                    maximumFractionDigits: 0
                  }) ?? '--'
                }
                loading={isLoading}
              />
              <SSVStack gap="none">
                <SSText size="xs" style={styles.labelText}>
                  {tn('hash')}
                </SSText>
                <SSText size="xs" style={styles.hashText} numberOfLines={2}>
                  {isLoading ? '--' : (chainData?.hash ?? '--')}
                </SSText>
              </SSVStack>
            </SSVStack>
          </SSVStack>

          {/* Consensus calculations — no network needed */}
          <SSVStack gap="sm">
            <SSText uppercase size="md" style={styles.sectionTitle}>
              {tn('consensus')}
            </SSText>
            <SSVStack gap="xs">
              <Row
                label={tn('difficultyEpoch')}
                value={epoch?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('blocksInEpoch')}
                value={blocksInEpoch?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('blocksUntilAdjustment')}
                value={blocksUntilAdj?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('estNextAdjustment')}
                value={estAdjDate ? formatDate(estAdjDate.getTime()) : '--'}
                loading={isLoading}
              />
              <Row
                label={tn('estHashRate')}
                value={
                  estHashRate !== null ? `${estHashRate.toFixed(2)} EH/s` : '--'
                }
                loading={isLoading}
              />
            </SSVStack>
          </SSVStack>

          {/* Opt-in external data */}
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

          {showExternal && difficultyAdjustment && (
            <SSVStack gap="sm">
              <SectionHeader
                title={tn('preciseAdjustment')}
                source="mempool"
                sourceLabel="mempool.space"
              />
              <SSVStack gap="xs">
                <Row
                  label={tn('difficultyChange')}
                  value={`${difficultyAdjustment.difficultyChange >= 0 ? '+' : ''}${difficultyAdjustment.difficultyChange.toFixed(2)}%`}
                  loading={isLoadingAdj}
                />
                <Row
                  label={tn('avgBlockTime')}
                  value={`${(difficultyAdjustment.timeAvg / 60_000).toFixed(1)} min`}
                  loading={isLoadingAdj}
                />
                <Row
                  label={tn('remainingBlocks')}
                  value={difficultyAdjustment.remainingBlocks.toLocaleString()}
                  loading={isLoadingAdj}
                />
                <Row
                  label={tn('progressPercent')}
                  value={`${difficultyAdjustment.progressPercent.toFixed(1)}%`}
                  loading={isLoadingAdj}
                />
                <Row
                  label={tn('estRetargetDate')}
                  value={formatDate(difficultyAdjustment.estimatedRetargetDate)}
                  loading={isLoadingAdj}
                />
              </SSVStack>
            </SSVStack>
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
  hashText: { color: Colors.gray['100'], fontFamily: 'monospace' },
  labelText: { color: Colors.gray['400'] },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  privacyNote: { color: Colors.gray['600'], marginTop: 4, textAlign: 'center' },
  row: { alignItems: 'center', paddingVertical: 4 },
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 },
  sourceBackend: { color: Colors.mainGreen, opacity: 0.8 },
  sourceMempool: { color: Colors.gray['500'] },
  valueText: { color: Colors.gray['100'] }
})
