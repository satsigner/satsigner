import { useQuery } from '@tanstack/react-query'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSExplorerRow from '@/components/SSExplorerRow'
import SSExplorerSectionHeader from '@/components/SSExplorerSectionHeader'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import { DIFFICULTY_ADJUSTMENT_INTERVAL } from '@/constants/consensus'
import { MS_PER_SECOND } from '@/constants/time'
import { useChainData } from '@/hooks/useChainData'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Typography } from '@/styles'
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

  function enableExternal() {
    setShowExternal(true)
  }

  function openTipBlock() {
    if (typeof height !== 'number') {
      return
    }
    router.push(`/explorer/block/${height}`)
  }

  const blocksInEpoch =
    height !== null ? height % DIFFICULTY_ADJUSTMENT_INTERVAL : null
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
          <SSLoader size={80} />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="xl" style={{ paddingBottom: 32, paddingTop: 20 }}>
          {/* Latest Block — from backend */}
          <SSVStack gap="sm">
            <SSExplorerSectionHeader
              title={tn('latestBlock')}
              source={chainData?.source ?? null}
              sourceLabel={
                chainData?.source ? sourceLabel(chainData.source) : null
              }
            />
            <SSVStack gap="xs">
              <Pressable
                onPress={openTipBlock}
                disabled={typeof height !== 'number'}
              >
                <SSExplorerRow
                  label={tn('height')}
                  value={height?.toLocaleString() ?? '--'}
                  loading={isLoading}
                />
              </Pressable>
              <SSExplorerRow
                label={tn('timestamp')}
                value={
                  chainData?.timestamp
                    ? formatDate(chainData.timestamp * MS_PER_SECOND)
                    : '--'
                }
                loading={isLoading}
              />
              <SSExplorerRow
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
              {typeof height === 'number' ? (
                <Pressable onPress={openTipBlock}>
                  <SSText size="xs" style={styles.linkText}>
                    {tn('viewBlock')}
                  </SSText>
                </Pressable>
              ) : null}
            </SSVStack>
          </SSVStack>

          {/* Consensus calculations — no network needed */}
          <SSVStack gap="sm">
            <SSText uppercase size="md" style={styles.sectionTitle}>
              {tn('consensus')}
            </SSText>
            <SSVStack gap="xs">
              <SSExplorerRow
                label={tn('difficultyEpoch')}
                value={epoch?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <SSExplorerRow
                label={tn('blocksInEpoch')}
                value={blocksInEpoch?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <SSExplorerRow
                label={tn('blocksUntilAdjustment')}
                value={blocksUntilAdj?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <SSExplorerRow
                label={tn('estNextAdjustment')}
                value={estAdjDate ? formatDate(estAdjDate.getTime()) : '--'}
                loading={isLoading}
              />
              <SSExplorerRow
                label={tn('estHashRate')}
                value={
                  estHashRate !== null ? `${estHashRate.toFixed(2)} EH/s` : '--'
                }
                loading={isLoading}
              />
            </SSVStack>
          </SSVStack>

          {!showExternal ? (
            <SSExplorerCapabilityBanner
              why={tn('externalWhy')}
              fix={tn('externalNote')}
              onLoad={enableExternal}
              loadLabel={tn('loadExternal')}
              loading={isLoadingAdj}
            />
          ) : null}

          {showExternal && difficultyAdjustment ? (
            <SSVStack gap="sm">
              <SSExplorerSectionHeader
                title={tn('preciseAdjustment')}
                source="mempool"
                sourceLabel="mempool.space"
              />
              <SSVStack gap="xs">
                <SSExplorerRow
                  label={tn('difficultyChange')}
                  value={`${difficultyAdjustment.difficultyChange >= 0 ? '+' : ''}${difficultyAdjustment.difficultyChange.toFixed(2)}%`}
                  loading={isLoadingAdj}
                />
                <SSExplorerRow
                  label={tn('avgBlockTime')}
                  value={`${(difficultyAdjustment.timeAvg / 60_000).toFixed(1)} min`}
                  loading={isLoadingAdj}
                />
                <SSExplorerRow
                  label={tn('remainingBlocks')}
                  value={difficultyAdjustment.remainingBlocks.toLocaleString()}
                  loading={isLoadingAdj}
                />
                <SSExplorerRow
                  label={tn('progressPercent')}
                  value={`${difficultyAdjustment.progressPercent.toFixed(1)}%`}
                  loading={isLoadingAdj}
                />
                <SSExplorerRow
                  label={tn('estRetargetDate')}
                  value={formatDate(difficultyAdjustment.estimatedRetargetDate)}
                  loading={isLoadingAdj}
                />
              </SSVStack>
            </SSVStack>
          ) : null}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  hashText: {
    color: Colors.gray['100'],
    fontFamily: Typography.geistMonoRegular
  },
  labelText: { color: Colors.gray['400'] },
  linkText: {
    color: Colors.white,
    marginTop: 4,
    textDecorationLine: 'underline'
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 }
})
