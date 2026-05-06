import { Stack, useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHalvingProgress from '@/components/SSHalvingProgress'
import SSText from '@/components/SSText'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import { useChainData } from '@/hooks/useChainData'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import {
  HALVING_INTERVAL,
  TARGET_BLOCK_TIME_SECONDS,
  blockSubsidySats,
  blocksUntilHalving,
  estimatedHalvingDate,
  halvingEpoch,
  historicalHalvings,
  nextHalvingHeight,
  percentIssued,
  totalMinedSats
} from '@/utils/bitcoin/consensus'
import { formatDate } from '@/utils/format'

const tn = _tn('explorer.halving')

const MAX_CIRCLE_RADIUS = 50
const INITIAL_SUBSIDY_SATS = 5_000_000_000

const HISTORICAL_HALVING_DATES: Record<number, string> = {
  0: '2009-01-03',
  1: '2012-11-28',
  2: '2016-07-09',
  3: '2020-05-11',
  4: '2024-04-19'
}

export default function ExplorerHalving() {
  const router = useRouter()
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  const { data: chainData, isLoading } = useChainData()

  const height = chainData?.height ?? null
  const epoch = height !== null ? halvingEpoch(height) : null
  const subsidySats = height !== null ? blockSubsidySats(height) : null
  const subsidyBtc =
    subsidySats !== null ? subsidySats / SATS_PER_BITCOIN : null
  const blocksThisEpoch = height !== null ? height % 210_000 : null
  const blocksRemaining = height !== null ? blocksUntilHalving(height) : null
  const nextHalving = height !== null ? nextHalvingHeight(height) : null
  const halvingDate = height !== null ? estimatedHalvingDate(height) : null
  const minedSats = height !== null ? totalMinedSats(height) : null
  const minedBtc = minedSats !== null ? minedSats / SATS_PER_BITCOIN : null
  const issued = height !== null ? percentIssued(height) : null
  const halvings = historicalHalvings()

  function sourceLabel() {
    return `${server.name} (${server.backend})`
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
          {/* Epoch progress visualization — shown at top by default */}
          {height !== null && (
            <SSVStack
              gap="none"
              style={{ alignItems: 'center', marginBottom: -24 }}
            >
              <SSHalvingProgress height={height} />
            </SSVStack>
          )}

          {/* Current epoch info — from backend */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('currentEpoch')}
              source={chainData?.source ?? null}
              sourceLabel={chainData?.source ? sourceLabel() : null}
            />
            <SSVStack gap="xs">
              <Row
                label={tn('height')}
                value={height?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('epoch')}
                value={epoch?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('subsidy')}
                value={subsidyBtc !== null ? `${subsidyBtc} BTC` : '--'}
                loading={isLoading}
              />
              <Row
                label={tn('blocksMinedThisEpoch')}
                value={blocksThisEpoch?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('blocksUntilHalving')}
                value={blocksRemaining?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('nextHalvingHeight')}
                value={nextHalving?.toLocaleString() ?? '--'}
                loading={isLoading}
              />
              <Row
                label={tn('estHalvingDate')}
                value={halvingDate ? formatDate(halvingDate.getTime()) : '--'}
                loading={isLoading}
              />
            </SSVStack>
          </SSVStack>

          {/* Supply — pure consensus calculations */}
          <SSVStack gap="sm">
            <SSText uppercase size="md" style={styles.sectionTitle}>
              {tn('supply')}
            </SSText>
            <SSVStack gap="xs">
              <Row
                label={tn('totalMined')}
                value={
                  minedBtc !== null
                    ? `${minedBtc.toLocaleString(undefined, { maximumFractionDigits: 2 })} BTC`
                    : '--'
                }
                loading={isLoading}
              />
              <Row
                label={tn('percentIssued')}
                value={issued !== null ? `${issued.toFixed(4)}%` : '--'}
                loading={isLoading}
              />
              <Row
                label={tn('maxSupply')}
                value="21,000,000 BTC"
                loading={false}
              />
            </SSVStack>
          </SSVStack>

          {/* Halving schedule — past confirmed + future projected */}
          <SSVStack gap="sm">
            <SSText uppercase size="md" style={styles.sectionTitle}>
              {tn('halvingSchedule')}
            </SSText>
            {/* Header row */}
            <SSHStack gap="none" style={styles.halvingHeaderRow}>
              <SSText size="xxs" style={[styles.colEpoch, styles.colHeader]}>
                #
              </SSText>
              <SSText size="xxs" style={[styles.colHeight, styles.colHeader]}>
                {tn('height').replace(' ', '\n')}
              </SSText>
              <SSText size="xxs" style={[styles.colSubsidy, styles.colHeader]}>
                {tn('subsidy').replace(' ', '\n')}
              </SSText>
              <View style={styles.colCircle} />
              <SSText size="xxs" style={[styles.colDate, styles.colHeader]}>
                {tn('date')}
              </SSText>
            </SSHStack>
            <SSVStack gap="xs">
              {halvings.map((h) => {
                const halvingHeight = h.epoch * HALVING_INTERVAL
                const isPast = height !== null && halvingHeight < height
                const isCurrent = epoch !== null && h.epoch === epoch
                const date = (() => {
                  if (HISTORICAL_HALVING_DATES[h.epoch]) {
                    return formatDate(HISTORICAL_HALVING_DATES[h.epoch])
                  }
                  if (height !== null) {
                    const blocksUntil = halvingHeight - height
                    const ms =
                      Date.now() +
                      blocksUntil * TARGET_BLOCK_TIME_SECONDS * 1000
                    return `~${formatDate(ms)}`
                  }
                  return '--'
                })()
                const textStyle = isCurrent
                  ? styles.halvingCurrent
                  : isPast
                    ? styles.halvingPast
                    : styles.halvingFuture
                const circleRadius = Math.max(
                  0.5,
                  MAX_CIRCLE_RADIUS * (h.subsidySats / INITIAL_SUBSIDY_SATS)
                )
                const circleOpacity = isCurrent ? 0.9 : isPast ? 0.5 : 0.2
                const circleColor = `rgba(255,255,255,${circleOpacity})`
                return (
                  <Pressable
                    key={h.epoch}
                    disabled={!isPast}
                    onPress={() =>
                      router.push(`/explorer/block?height=${halvingHeight}`)
                    }
                  >
                    <SSHStack gap="none" style={styles.halvingRow}>
                      <SSText size="xs" style={[styles.colEpoch, textStyle]}>
                        {h.epoch}
                      </SSText>
                      <SSText size="xs" style={[styles.colHeight, textStyle]}>
                        {halvingHeight.toLocaleString()}
                      </SSText>
                      <SSText size="xs" style={[styles.colSubsidy, textStyle]}>
                        {(h.subsidySats / SATS_PER_BITCOIN)
                          .toFixed(8)
                          .replace(/\.?0+$/, '')}
                      </SSText>
                      <View style={styles.colCircle}>
                        <View
                          style={{
                            backgroundColor: circleColor,
                            borderRadius: circleRadius,
                            height: circleRadius * 2,
                            width: circleRadius * 2
                          }}
                        />
                      </View>
                      <SSText size="xs" style={[styles.colDate, textStyle]}>
                        {date}
                      </SSText>
                    </SSHStack>
                  </Pressable>
                )
              })}
            </SSVStack>
          </SSVStack>
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
  colCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    width: MAX_CIRCLE_RADIUS * 2 + 8
  },
  colDate: { flex: 2, textAlign: 'right' },
  colEpoch: { flex: 0.5 },
  colHeader: { color: Colors.gray['600'], letterSpacing: 1 },
  colHeight: { flex: 1.5 },
  colSubsidy: { flex: 1.5 },
  container: { paddingTop: 0 },
  halvingCurrent: { color: Colors.white },
  halvingFuture: { color: Colors.gray['500'] },
  halvingHeaderRow: {
    alignItems: 'flex-start',
    overflow: 'visible',
    paddingBottom: 4
  },
  halvingPast: { color: Colors.gray['400'] },
  halvingRow: { alignItems: 'center', height: 28, overflow: 'visible' },
  labelText: { color: Colors.gray['400'] },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  row: { alignItems: 'center', paddingVertical: 4 },
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 },
  sourceBackend: { color: Colors.mainGreen, opacity: 0.8 },
  sourceMempool: { color: Colors.gray['500'] },
  valueText: { color: Colors.gray['100'] }
})
