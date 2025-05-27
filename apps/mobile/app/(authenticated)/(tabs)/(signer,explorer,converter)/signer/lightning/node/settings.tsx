/* eslint-disable no-console */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { Alert, ScrollView, StyleSheet, View } from 'react-native'

import { SSIconChevronLeft, SSIconRefresh } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useLightningStore } from '@/store/lightning'

// Format version to only keep first three numbers matching ##.##.## pattern
const formatVersion = (version: string) => {
  // Remove any non-numeric characters except dots
  const cleanVersion = version.replace(/[^0-9.]/g, '')
  // Split by dots and filter out empty strings
  const parts = cleanVersion.split('.').filter(Boolean)

  // If we have at least 3 numbers
  if (parts.length >= 3) {
    // Check if it matches our pattern (1-2 digits per part)
    const isValidPattern = parts
      .slice(0, 3)
      .every((part) => /^[0-9]{1,2}$/.test(part))

    if (isValidPattern) {
      // Always take only first 3 numbers
      return parts.slice(0, 3).join('.')
    }
  }

  return '0.0.0'
}

export default function NodeSettingsPage() {
  const router = useRouter()
  const params = useLocalSearchParams<{ alias: string }>()
  const { config, clearConfig } = useLightningStore()
  const { isConnected, isConnecting, lastError, nodeInfo, getInfo } = useLND()
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDisconnect = useCallback(async () => {
    setIsLoading(true)
    try {
      clearConfig()
      router.back()
    } catch (error) {
      console.error('Error disconnecting:', error)
    } finally {
      setIsLoading(false)
    }
  }, [clearConfig, router])

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleDelete = useCallback(async () => {
    Alert.alert(
      'Clear Config',
      'Are you sure you want to clear this node configuration? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true)
            try {
              clearConfig()
              router.navigate('/signer/lightning')
            } catch (error) {
              console.error('Error clearing config:', error)
              Alert.alert(
                'Error',
                'Failed to clear node configuration. Please try again.'
              )
            } finally {
              setIsDeleting(false)
            }
          }
        }
      ]
    )
  }, [clearConfig, router])

  const handleRefresh = useCallback(async () => {
    if (!isConnected) return
    setIsLoading(true)
    try {
      await getInfo()
    } catch (error) {
      console.error('Error refreshing node info:', error)
    } finally {
      setIsLoading(false)
    }
  }, [getInfo, isConnected])

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {params.alias} Settings
            </SSText>
          ),
          headerLeft: () => (
            <SSIconButton onPress={handleBack}>
              <SSIconChevronLeft height={20} width={20} />
            </SSIconButton>
          ),
          headerRight: () => (
            <SSIconButton
              onPress={handleRefresh}
              disabled={!isConnected || isConnecting}
            >
              <SSIconRefresh height={18} width={22} />
            </SSIconButton>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack style={styles.section} gap="md">
            {/* Node Information */}
            <View style={styles.section}>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                Node Information
              </SSText>
              {nodeInfo && (
                <>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Version</SSText>
                    <SSText>{formatVersion(nodeInfo.version)}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Channels</SSText>
                    <SSText>{nodeInfo.num_active_channels}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Peers</SSText>
                    <SSText>{nodeInfo.num_peers}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Chain Sync</SSText>
                    <SSText
                      color={nodeInfo.synced_to_chain ? 'white' : 'muted'}
                    >
                      {nodeInfo.synced_to_chain ? 'Synced' : 'Not synced'}
                    </SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Block Height</SSText>
                    <SSText>{nodeInfo.block_height}</SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Block Hash</SSText>
                    <SSText
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      style={styles.hash}
                    >
                      {nodeInfo.block_hash}
                    </SSText>
                  </View>
                </>
              )}
            </View>

            {/* Connection Status */}
            <View style={styles.section}>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                Connection Status
              </SSText>
              <View style={styles.infoItem}>
                <SSText color="muted">Status</SSText>
                <SSText color={isConnected ? 'white' : 'muted'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </SSText>
              </View>
              {lastError && (
                <View style={styles.infoItem}>
                  <SSText color="muted">Last Error</SSText>
                  <SSText color="muted" size="sm">
                    {lastError}
                  </SSText>
                </View>
              )}
            </View>

            {/* Node Configuration */}
            <View style={styles.section}>
              <SSText color="muted" size="sm" style={styles.sectionTitle}>
                Node Configuration
              </SSText>
              {config && (
                <>
                  <View style={styles.infoItem}>
                    <SSText color="muted">URL</SSText>
                    <SSText numberOfLines={1} ellipsizeMode="middle">
                      {config.url}
                    </SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Macaroon</SSText>
                    <SSText numberOfLines={1} ellipsizeMode="middle">
                      {config.macaroon ? '••••••••' : 'Not set'}
                    </SSText>
                  </View>
                  <View style={styles.infoItem}>
                    <SSText color="muted">Certificate</SSText>
                    <SSText numberOfLines={1} ellipsizeMode="middle">
                      {config.cert ? '••••••••' : 'Not set'}
                    </SSText>
                  </View>
                </>
              )}
            </View>

            {/* Actions */}
            <SSVStack style={styles.actions} gap="sm">
              <SSButton
                label="Disconnect Node"
                onPress={handleDisconnect}
                variant="outline"
                style={styles.button}
                loading={isLoading}
                disabled={!isConnected || isConnecting}
              />
              <SSButton
                label="Clear Config"
                onPress={handleDelete}
                variant="danger"
                style={styles.button}
                loading={isDeleting}
                disabled={isConnecting}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    flex: 1,
    paddingTop: 10
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: 32
  },
  section: {
    padding: 16
  },
  sectionTitle: {
    marginBottom: 4
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  actions: {
    marginTop: 8
  },
  button: {
    minHeight: 40
  },
  hash: {
    maxWidth: '70%',
    fontFamily: 'monospace'
  }
})
