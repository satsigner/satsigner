import { Stack } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { useChainData } from '@/hooks/useChainData'
import { useBitnodesNodeInfo, useElectrumServerInfo } from '@/hooks/useNodeData'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { formatDate, formatTime, formatTimeFromNow } from '@/utils/format'

const tn = _tn('explorer.node')
const tnTime = _tn('time')

export default function ExplorerNode() {
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const [showExternal, setShowExternal] = useState(false)

  const { data: chainData, isLoading: isLoadingChain } = useChainData()
  const { data: serverInfo, isLoading: isLoadingInfo } = useElectrumServerInfo()
  const { data: bitnodesInfo, isLoading: isLoadingBitnodes } =
    useBitnodesNodeInfo(showExternal)

  const isElectrum = server.backend === 'electrum'

  function formatBlockAge(timestampSeconds: number): string {
    const elapsedMs = Date.now() - timestampSeconds * 1000
    const [value, unit] = formatTimeFromNow(elapsedMs)
    const floored = Math.floor(value)
    if (unit === 'second') {
      return tnTime('justNow')
    }
    if (floored === 1) {
      return tnTime(`${unit}Ago`)
    }
    return tnTime(`${unit}sAgo`, { value: floored.toString() })
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      {(isLoadingChain || isLoadingInfo) && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="white" size="large" />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="xl" style={{ paddingBottom: 32, paddingTop: 20 }}>
          {/* Server configuration — from local config, no network needed */}
          <SSVStack gap="sm">
            <SSText uppercase size="md" style={styles.sectionTitle}>
              {tn('serverConfig')}
            </SSText>
            <SSVStack gap="xs">
              <Row
                label={tn('serverName')}
                value={server.name || '--'}
                loading={false}
              />
              <Row
                label={tn('backend')}
                value={server.backend || '--'}
                loading={false}
              />
              <Row
                label={tn('network')}
                value={selectedNetwork}
                loading={false}
              />
              <SSVStack gap="none">
                <SSText size="xs" style={styles.labelText}>
                  {tn('serverUrl')}
                </SSText>
                <SSText size="xs" style={styles.hashText}>
                  {server.url || '--'}
                </SSText>
              </SSVStack>
            </SSVStack>
          </SSVStack>

          {/* Current tip — from backend */}
          <SSVStack gap="sm">
            <SectionHeader
              title={tn('currentTip')}
              source={chainData?.source ?? null}
              sourceLabel={
                chainData?.source === 'backend'
                  ? `${server.name} (${server.backend})`
                  : 'mempool.space'
              }
            />
            <SSVStack gap="xs">
              <Row
                label={tn('height')}
                value={chainData?.height?.toLocaleString() ?? '--'}
                loading={isLoadingChain}
              />
              <Row
                label={tn('timestamp')}
                value={
                  chainData?.timestamp
                    ? `${formatDate(chainData.timestamp * 1000)} · ${formatTime(new Date(chainData.timestamp * 1000))}`
                    : '--'
                }
                loading={isLoadingChain}
              />
              <Row
                label={tn('blockAge')}
                value={
                  chainData?.timestamp
                    ? formatBlockAge(chainData.timestamp)
                    : '--'
                }
                loading={isLoadingChain}
              />
            </SSVStack>
          </SSVStack>

          {/* Electrum server info — from server */}
          {isElectrum && (
            <SSVStack gap="sm">
              <SectionHeader
                title={tn('serverInfo')}
                source="backend"
                sourceLabel={`${server.name} (electrum)`}
              />
              <SSVStack gap="xs">
                <Row
                  label={tn('software')}
                  value={serverInfo?.serverSoftware || '--'}
                  loading={isLoadingInfo}
                />
                <Row
                  label={tn('protocolVersion')}
                  value={serverInfo?.protocolVersion || '--'}
                  loading={isLoadingInfo}
                />
                {serverInfo?.banner ? (
                  <SSVStack gap="none">
                    <SSText size="xs" style={styles.labelText}>
                      {tn('banner')}
                    </SSText>
                    <SSText
                      size="xs"
                      style={styles.bannerText}
                      numberOfLines={6}
                    >
                      {serverInfo.banner}
                    </SSText>
                  </SSVStack>
                ) : null}
              </SSVStack>
            </SSVStack>
          )}

          {/* Bitnodes opt-in */}
          {!showExternal && (
            <SSVStack style={{ alignItems: 'center' }}>
              <SSButton
                label={tn('loadBitnodes')}
                variant="outline"
                onPress={() => setShowExternal(true)}
              />
              <SSText size="xs" style={styles.privacyNote}>
                {tn('externalNote')}
              </SSText>
            </SSVStack>
          )}

          {showExternal && (
            <SSVStack gap="sm">
              <SectionHeader
                title={tn('bitnodesInfo')}
                source="mempool"
                sourceLabel="bitnodes.io"
              />
              {isLoadingBitnodes && (
                <SSText size="sm" style={styles.labelText}>
                  {tn('loading')}
                </SSText>
              )}
              {!isLoadingBitnodes && bitnodesInfo === null && (
                <SSText size="sm" style={styles.labelText}>
                  {tn('notFound')}
                </SSText>
              )}
              {bitnodesInfo && (
                <SSVStack gap="xs">
                  <Row
                    label={tn('address')}
                    value={bitnodesInfo.address}
                    loading={false}
                  />
                  <Row
                    label={tn('userAgent')}
                    value={bitnodesInfo.userAgent}
                    loading={false}
                  />
                  <Row
                    label={tn('nodeHeight')}
                    value={bitnodesInfo.height.toLocaleString()}
                    loading={false}
                  />
                  <Row
                    label={tn('lastSeen')}
                    value={formatDate(bitnodesInfo.lastSeen * 1000)}
                    loading={false}
                  />
                </SSVStack>
              )}
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
  bannerText: {
    color: Colors.gray['300'],
    fontFamily: 'monospace',
    marginTop: 2
  },
  container: { paddingTop: 0 },
  hashText: { color: Colors.gray['100'], fontFamily: 'monospace' },
  labelText: { color: Colors.gray['400'] },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  privacyNote: { color: Colors.gray['600'], marginTop: 4, textAlign: 'center' },
  row: { alignItems: 'center', paddingVertical: 4 },
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 },
  sourceBackend: { color: Colors.mainGreen, opacity: 0.8 },
  sourceMempool: { color: Colors.gray['500'] },
  valueText: { color: Colors.gray['100'] }
})
