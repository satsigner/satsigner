import { Stack, useRouter } from 'expo-router'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { useLND } from '@/hooks/useLND'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useLightningStore } from '@/store/lightning'

export default function LightningPage() {
  const router = useRouter()
  const { config } = useLightningStore()
  const { nodeInfo, isConnected } = useLND()

  const handleRCPPress = () => {
    // TODO: Implement RCP functionality
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
        pathname: '/signer/lightning/node',
        params: {
          alias: nodeInfo?.alias || 'Unknown Node',
          pubkey: nodeInfo?.identity_pubkey || 'Not connected'
        }
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
  mainLayout: {
    paddingTop: 32,
    paddingHorizontal: '5%'
  },
  content: {
    flex: 1,
    alignItems: 'center'
  },
  headerText: {
    marginBottom: 8
  },
  subtitle: {
    marginBottom: 32,
    textAlign: 'center'
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginTop: 24
  },
  button: {
    width: '100%'
  },
  card: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginTop: 24,
    overflow: 'hidden'
  },
  cardContent: {
    padding: 16,
    gap: 12
  },
  cardDetails: {
    gap: 8
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pubkey: {
    maxWidth: '70%',
    fontFamily: 'monospace'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tapHint: {
    alignSelf: 'center',
    marginTop: 8
  }
})
