import { Stack, usePathname, useRouter, useSegments } from 'expo-router'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { showNavigation } from '@/utils/navigation'

export default function LightningPage() {
  const router = useRouter()
  const pathname = usePathname()
  const segments = useSegments()
  const showDrawerNav = showNavigation(pathname, segments.length)
  const { config } = useLightningStore()
  const { nodeInfo, isConnected } = useLND()

  const handleRCPPress = () => {
    // TODO: Implement RCP functionality
  }

  function goToSignerLanding() {
    router.replace({
      params: { tab: t('navigation.label.signer') },
      pathname: '/(authenticated)/(tabs)/(signer)'
    })
  }

  const handleLNDRestPress = () => {
    router.navigate('/signer/lightning/LNDRest')
  }

  const handleLDKPress = () => {
    // TODO: Implement LDK functionality
  }

  const handleConfigPress = () => {
    if (config) {
      router.navigate({
        params: {
          alias: nodeInfo?.alias || 'Unknown Node',
          pubkey: nodeInfo?.identity_pubkey || 'Not connected'
        },
        pathname: '/signer/lightning/node'
      })
    }
  }

  const renderConfigCard = () => {
    if (!config) {
      return null
    }

    const alias = nodeInfo?.alias || 'Unknown Node'
    const pubkey = nodeInfo?.identity_pubkey || 'Not connected'
    const channels = nodeInfo?.num_active_channels || 0
    const peers = nodeInfo?.num_peers || 0
    const synced = nodeInfo?.synced_to_chain ? 'Synced' : 'Not synced'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={handleConfigPress}
        activeOpacity={0.7}
      >
        <SSVStack style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <SSText uppercase weight="bold" size="lg">
              {alias}
            </SSText>
            <SSText color={isConnected ? 'white' : 'muted'} size="sm">
              {isConnected ? 'Connected' : 'Disconnected'}
            </SSText>
          </View>

          <SSVStack style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <SSText color="muted">Pubkey:</SSText>
              <SSText
                numberOfLines={1}
                ellipsizeMode="middle"
                style={styles.pubkey}
              >
                {pubkey}
              </SSText>
            </View>

            {isConnected && (
              <>
                <View style={styles.detailRow}>
                  <SSText color="muted">Channels:</SSText>
                  <SSText>{channels}</SSText>
                </View>

                <View style={styles.detailRow}>
                  <SSText color="muted">Peers:</SSText>
                  <SSText>{peers}</SSText>
                </View>

                <View style={styles.detailRow}>
                  <SSText color="muted">Chain:</SSText>
                  <SSText color={nodeInfo?.synced_to_chain ? 'white' : 'muted'}>
                    {synced}
                  </SSText>
                </View>
              </>
            )}
          </SSVStack>

          <SSText color="muted" size="sm" style={styles.tapHint}>
            Tap to view details
          </SSText>
        </SSVStack>
      </TouchableOpacity>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          ...(showDrawerNav
            ? {}
            : {
                headerLeft: () => (
                  <SSIconButton
                    style={{
                      height: 30,
                      paddingHorizontal: 8,
                      paddingTop: 8,
                      width: 30
                    }}
                    onPress={goToSignerLanding}
                  >
                    <SSIconBackArrow height={16} width={7} />
                  </SSIconButton>
                )
              }),
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              Lightning
            </SSText>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <SSVStack style={styles.content}>
          {renderConfigCard()}

          <SSVStack style={styles.buttonContainer}>
            <SSText center color="muted">
              Connect to existing node
            </SSText>
            <SSButton
              label="LND Rest"
              onPress={handleLNDRestPress}
              variant="gradient"
              gradientType="special"
              style={styles.button}
            />
            <SSButton
              label="LND RCP"
              onPress={handleRCPPress}
              variant="gradient"
              gradientType="special"
              disabled
              style={styles.button}
            />

            <SSText center color="muted">
              Create new node
            </SSText>
            <SSButton
              label="LDK"
              onPress={handleLDKPress}
              variant="gradient"
              gradientType="special"
              disabled
              style={styles.button}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    width: '100%'
  },
  buttonContainer: {
    gap: 16,
    marginTop: 24,
    width: '100%'
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginTop: 24,
    overflow: 'hidden',
    width: '100%'
  },
  cardContent: {
    gap: 12,
    padding: 16
  },
  cardDetails: {
    gap: 8
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  content: {
    alignItems: 'center',
    flex: 1
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  headerText: {
    marginBottom: 8
  },
  mainLayout: {
    paddingTop: 32
  },
  pubkey: {
    fontFamily: 'monospace',
    maxWidth: '70%'
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center'
  },
  tapHint: {
    alignSelf: 'center',
    marginTop: 8
  }
})
