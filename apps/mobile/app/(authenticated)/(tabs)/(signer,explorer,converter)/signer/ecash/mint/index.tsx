import { Stack, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

const DEFAULT_MINTS = [
  { url: 'https://mint.minibits.cash/Bitcoin', name: 'Bitcoin Minibits mint' },
  { url: 'https://mint.cubabitcoin.org', name: 'Mint Cuba Bitcoin' },
  { url: 'https://mint.lnvoltz.com', name: 'Voltz Mint' },
  { url: 'https://21mint.me', name: '21Mint' },
  { url: 'https://mint.coinos.io', name: 'Coinos' }
]

export default function EcashMintPage() {
  const router = useRouter()
  const [mintUrl, setMintUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const { mints, connectToMint, disconnectMint } = useEcash()
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)

  const handleConnectMint = useCallback(async () => {
    if (!mintUrl) {
      toast.error('Please enter a mint URL')
      return
    }

    setIsConnecting(true)
    try {
      await connectToMint(mintUrl)
      setMintUrl('')
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsConnecting(false)
    }
  }, [mintUrl, connectToMint])

  const handleSelectDefaultMint = useCallback((url: string) => {
    setMintUrl(url)
  }, [])

  const handleRemoveMint = useCallback(
    (url: string) => {
      disconnectMint(url)
    },
    [disconnectMint]
  )

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ecash.mint.title')}</SSText>
        }}
      />

      <ScrollView>
        <SSVStack gap="lg">
          {/* Connect to Mint Section */}
          <SSVStack gap="md">
            {mints.length > 0 && (
              <SSVStack gap="xs" style={styles.warningContainer}>
                <SSText color="white" size="sm" center>
                  Currently only one mint can be connected at a time
                </SSText>
                <SSText color="muted" size="xs" center>
                  Connecting to a new mint will disconnect the current one
                </SSText>
              </SSVStack>
            )}

            <SSVStack gap="xs">
              <SSText uppercase>{t('ecash.mint.url')}</SSText>
              <SSTextInput
                value={mintUrl}
                onChangeText={setMintUrl}
                placeholder="https://mint.example.com"
                keyboardType="url"
              />
            </SSVStack>

            <SSButton
              label={mints.length > 0 ? 'Switch Mint' : t('ecash.mint.connect')}
              onPress={handleConnectMint}
              loading={isConnecting}
              variant="gradient"
              gradientType="special"
            />
          </SSVStack>

          {/* Connected Mint */}
          {mints.length > 0 && (
            <SSVStack gap="md">
              <SSText uppercase>Connected Mint</SSText>
              {mints.map((mint) => (
                <View key={mint.url} style={styles.mintCard}>
                  <SSVStack gap="sm">
                    <SSText weight="medium">{mint.name || mint.url}</SSText>
                    <SSText color="muted" size="sm">
                      {mint.url}
                    </SSText>
                    <SSHStack gap="md">
                      <SSVStack gap="xs">
                        <SSText color="muted" size="xs" uppercase>
                          {t('ecash.mint.balance')}
                        </SSText>
                        <SSText weight="medium">
                          {formatNumber(mint.balance, 0, useZeroPadding)} sats
                        </SSText>
                      </SSVStack>
                      <SSVStack gap="xs">
                        <SSText color="muted" size="xs" uppercase>
                          {t('ecash.mint.status')}
                        </SSText>
                        <SSText style={{ color: Colors.success }}>
                          {t('common.connected')}
                        </SSText>
                      </SSVStack>
                    </SSHStack>
                    <SSButton
                      label={t('common.remove')}
                      onPress={() => handleRemoveMint(mint.url)}
                      variant="danger"
                      style={styles.removeButton}
                    />
                  </SSVStack>
                </View>
              ))}
            </SSVStack>
          )}

          {/* Empty State */}
          {mints.length === 0 && (
            <SSVStack gap="md" style={styles.emptyState}>
              <SSText color="muted" center>
                No mints connected yet
              </SSText>
              <SSText color="muted" size="sm" center>
                Connect to a mint to start using ecash
              </SSText>
            </SSVStack>
          )}

          {/* Popular Mints Section */}
          <SSVStack gap="md">
            <SSText uppercase>{t('ecash.mint.defaultMints')}</SSText>
            <SSVStack gap="xs">
              {DEFAULT_MINTS.map((mint) => (
                <SSButton
                  key={mint.url}
                  label={mint.name}
                  onPress={() => handleSelectDefaultMint(mint.url)}
                  variant="subtle"
                  style={styles.defaultMintButton}
                />
              ))}
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  removeButton: {
    marginTop: 8
  },
  mintCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333'
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  defaultMintButton: {
    marginBottom: 2,
    opacity: 0.7
  },
  warningContainer: {
    backgroundColor: Colors.gray[900],
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.warning
  }
})
