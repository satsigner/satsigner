import { Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSExplorerRow from '@/components/SSExplorerRow'
import SSExplorerSectionHeader from '@/components/SSExplorerSectionHeader'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import { MS_PER_SECOND } from '@/constants/time'
import { useChainData } from '@/hooks/useChainData'
import { useBackendServerInfo, useBitnodesNodeInfo } from '@/hooks/useNodeData'
import { useNow } from '@/hooks/useNow'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Typography } from '@/styles'
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
  const { data: serverInfo, isLoading: isLoadingInfo } = useBackendServerInfo()
  const { data: bitnodesInfo, isLoading: isLoadingBitnodes } =
    useBitnodesNodeInfo(showExternal)
  const nowMs = useNow()

  const showServerInfo =
    server.backend === 'electrum' || server.backend === 'rpc'

  function formatBlockAge(timestampSeconds: number): string {
    const elapsedMs = nowMs - timestampSeconds * MS_PER_SECOND
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
          <SSLoader size={80} />
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
              <SSExplorerRow
                label={tn('serverName')}
                value={server.name || '--'}
                loading={false}
              />
              <SSExplorerRow
                label={tn('backend')}
                value={server.backend || '--'}
                loading={false}
              />
              <SSExplorerRow
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
            <SSExplorerSectionHeader
              title={tn('currentTip')}
              source={chainData?.source ?? null}
              sourceLabel={
                chainData?.source === 'backend'
                  ? `${server.name} (${server.backend})`
                  : 'mempool.space'
              }
            />
            <SSVStack gap="xs">
              <SSExplorerRow
                label={tn('height')}
                value={chainData?.height?.toLocaleString() ?? '--'}
                loading={isLoadingChain}
              />
              <SSExplorerRow
                label={tn('timestamp')}
                value={
                  chainData?.timestamp
                    ? `${formatDate(chainData.timestamp * MS_PER_SECOND)} · ${formatTime(new Date(chainData.timestamp * MS_PER_SECOND))}`
                    : '--'
                }
                loading={isLoadingChain}
              />
              <SSExplorerRow
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

          {/* Backend server info — Electrum banner / Core subversion */}
          {showServerInfo && (
            <SSVStack gap="sm">
              <SSExplorerSectionHeader
                title={tn('serverInfo')}
                source="backend"
                sourceLabel={`${server.name} (${server.backend})`}
              />
              <SSVStack gap="xs">
                <SSExplorerRow
                  label={tn('software')}
                  value={serverInfo?.serverSoftware || '--'}
                  loading={isLoadingInfo}
                />
                <SSExplorerRow
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
                      numberOfLines={8}
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
              <SSExplorerSectionHeader
                title={tn('bitnodesInfo')}
                source="mempool"
                sourceLabel="bitnodes.io"
              />
              {isLoadingBitnodes && (
                <View style={styles.inlineLoading}>
                  <SSLoader size={64} />
                </View>
              )}
              {!isLoadingBitnodes && bitnodesInfo === null && (
                <SSText size="sm" style={styles.labelText}>
                  {tn('notFound')}
                </SSText>
              )}
              {bitnodesInfo && (
                <SSVStack gap="xs">
                  <SSExplorerRow
                    label={tn('address')}
                    value={bitnodesInfo.address}
                    loading={false}
                  />
                  <SSExplorerRow
                    label={tn('userAgent')}
                    value={bitnodesInfo.userAgent}
                    loading={false}
                  />
                  <SSExplorerRow
                    label={tn('nodeHeight')}
                    value={bitnodesInfo.height.toLocaleString()}
                    loading={false}
                  />
                  <SSExplorerRow
                    label={tn('lastSeen')}
                    value={formatDate(bitnodesInfo.lastSeen * MS_PER_SECOND)}
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

const styles = StyleSheet.create({
  bannerText: {
    color: Colors.gray['300'],
    fontFamily: Typography.geistMonoRegular,
    marginTop: 2
  },
  container: { paddingTop: 0 },
  hashText: {
    color: Colors.gray['100'],
    fontFamily: Typography.geistMonoRegular
  },
  inlineLoading: {
    alignItems: 'center',
    paddingVertical: 24
  },
  labelText: { color: Colors.gray['400'] },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  privacyNote: { color: Colors.gray['600'], marginTop: 4, textAlign: 'center' },
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 }
})
