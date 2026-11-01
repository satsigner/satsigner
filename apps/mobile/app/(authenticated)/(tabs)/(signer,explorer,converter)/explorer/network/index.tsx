import { Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSExplorerRow from '@/components/SSExplorerRow'
import SSExplorerSectionHeader from '@/components/SSExplorerSectionHeader'
import SSLoader from '@/components/SSLoader'
import SSNetworkDots from '@/components/SSNetworkDots'
import SSText from '@/components/SSText'
import { useChainData } from '@/hooks/useChainData'
import { useBitnodesNetworkStats } from '@/hooks/useNodeData'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'

const tn = _tn('explorer.network')

export default function ExplorerNetwork() {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const [showExternal, setShowExternal] = useState(false)
  const [showVisualization, setShowVisualization] = useState(false)

  const { data: chainData, isLoading: isLoadingChain } = useChainData()
  const { data: networkStats, isLoading: isLoadingStats } =
    useBitnodesNetworkStats(showExternal)

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      {isLoadingChain && (
        <View style={styles.loadingContainer}>
          <SSLoader size={80} />
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="xl" style={{ paddingBottom: 32, paddingTop: 20 }}>
          {/* Local node view — from backend */}
          <SSVStack gap="sm">
            <SSText uppercase size="md" style={styles.sectionTitle}>
              {tn('localView')}
            </SSText>
            <SSVStack gap="xs">
              <SSExplorerRow
                label={tn('network')}
                value={selectedNetwork}
                loading={false}
              />
              <SSExplorerRow
                label={tn('height')}
                value={chainData?.height?.toLocaleString() ?? '--'}
                loading={isLoadingChain}
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
              {/* Network overview — Bitnodes */}
              <SSVStack gap="sm">
                <SSExplorerSectionHeader
                  title={tn('networkOverview')}
                  source="mempool"
                  sourceLabel="bitnodes.io"
                />
                <SSVStack gap="xs">
                  <SSExplorerRow
                    label={tn('totalNodes')}
                    value={networkStats?.totalNodes?.toLocaleString() ?? '--'}
                    loading={isLoadingStats}
                  />
                </SSVStack>
              </SSVStack>

              {/* Version distribution */}
              {networkStats?.versionDistribution &&
                networkStats.versionDistribution.length > 0 && (
                  <SSVStack gap="sm">
                    <SSExplorerSectionHeader
                      title={tn('clientVersions')}
                      source="mempool"
                      sourceLabel="bitnodes.io"
                    />
                    <SSVStack gap="xs">
                      {networkStats.versionDistribution.map((entry) => (
                        <SSHStack
                          key={entry.version}
                          justifyBetween
                          style={styles.row}
                        >
                          <SSText
                            size="sm"
                            style={styles.labelText}
                            numberOfLines={1}
                          >
                            {entry.version}
                          </SSText>
                          <SSText size="sm" style={styles.valueText}>
                            {entry.count.toLocaleString()}
                          </SSText>
                        </SSHStack>
                      ))}
                    </SSVStack>
                  </SSVStack>
                )}

              {/* Country distribution */}
              {networkStats?.countryDistribution &&
                networkStats.countryDistribution.length > 0 && (
                  <SSVStack gap="sm">
                    <SSExplorerSectionHeader
                      title={tn('countryDistribution')}
                      source="mempool"
                      sourceLabel="bitnodes.io"
                    />
                    <SSVStack gap="xs">
                      {networkStats.countryDistribution.map((entry) => (
                        <SSHStack
                          key={entry.country}
                          justifyBetween
                          style={styles.row}
                        >
                          <SSText size="sm" style={styles.labelText}>
                            {entry.country}
                          </SSText>
                          <SSText size="sm" style={styles.valueText}>
                            {entry.count.toLocaleString()}
                          </SSText>
                        </SSHStack>
                      ))}
                    </SSVStack>
                  </SSVStack>
                )}

              {/* Visualization opt-in */}
              {!showVisualization &&
              networkStats?.countryDistribution?.length ? (
                <SSVStack style={{ alignItems: 'center' }}>
                  <SSButton
                    label={tn('showVisualization')}
                    variant="outline"
                    onPress={() => setShowVisualization(true)}
                  />
                </SSVStack>
              ) : null}

              {showVisualization &&
              networkStats?.countryDistribution?.length ? (
                <SSVStack gap="sm">
                  <SSText uppercase size="md" style={styles.sectionTitle}>
                    {tn('nodeDistribution')}
                  </SSText>
                  <SSNetworkDots
                    distribution={networkStats.countryDistribution}
                  />
                </SSVStack>
              ) : null}
            </>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  labelText: { color: Colors.gray['400'] },
  loadingContainer: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  privacyNote: { color: Colors.gray['600'], marginTop: 4, textAlign: 'center' },
  row: { alignItems: 'center', paddingVertical: 4 },
  sectionTitle: { color: Colors.gray['400'], letterSpacing: 1.5 },
  valueText: { color: Colors.gray['100'] }
})
