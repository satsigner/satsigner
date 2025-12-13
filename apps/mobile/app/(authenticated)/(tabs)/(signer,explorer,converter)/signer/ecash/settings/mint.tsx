import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconBlackIndicator, SSIconGreenIndicator } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useEcashStore } from '@/store/ecash'
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
  const [mintUrl, setMintUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const { mints, connectToMint, disconnectMint } = useEcash()

  const ecashStatus = useEcashStore((state) => state.status)
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
  const zeroPadding = useZeroPadding || currencyUnit === 'btc'

  function getConnectionErrorMessage(error?: string): string {
    if (!error) {
      return t('ecash.error.mintNotConnected')
    }

    const errorLower = error.toLowerCase()

    // Check for rate limiting (HTTP 429 or rate limit messages)
    if (
      errorLower.includes('429') ||
      errorLower.includes('rate limit') ||
      errorLower.includes('too many requests') ||
      errorLower.includes('rate limited')
    ) {
      return t('ecash.error.mintRateLimited')
    }

    // Check for blocked/forbidden (HTTP 403 or blocked messages)
    if (
      errorLower.includes('403') ||
      errorLower.includes('forbidden') ||
      errorLower.includes('blocked') ||
      errorLower.includes('access denied')
    ) {
      return t('ecash.error.mintBlocked')
    }

    // Default to showing the actual error message or generic not connected
    return error || t('ecash.error.mintNotConnected')
  }

  const handleConnectMint = useCallback(async () => {
    if (!mintUrl) {
      toast.error('Please enter a mint URL')
      return
    }

    setIsConnecting(true)
    try {
      await connectToMint(mintUrl)
      setMintUrl('')
    } catch {
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

        <SSVStack gap="lg">
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
                            {formatNumber(mint.balance, 0, zeroPadding)}{' '}
                            {currencyUnit === 'btc'
                              ? t('bitcoin.btc')
                              : t('bitcoin.sats')}
                          </SSText>
                        </SSVStack>
                        <SSVStack gap="xs">
                          <SSText color="muted" size="xs" uppercase>
                            {t('ecash.mint.status')}
                          </SSText>
                          <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                            {mint.isConnected ? (
                              <SSIconGreenIndicator height={12} width={12} />
                            ) : (
                              <SSIconBlackIndicator height={12} width={12} />
                            )}
                            <SSText
                              style={{
                                color: mint.isConnected
                                  ? Colors.success
                                  : Colors.gray[500]
                              }}
                            >
                              {mint.isConnected
                                ? t('common.connected')
                                : t('common.notConnected')}
                            </SSText>
                          </SSHStack>
                        </SSVStack>
                      </SSHStack>
                      {!mint.isConnected && (
                        <SSText
                          size="xs"
                          style={[styles.errorText, { color: Colors.error }]}
                        >
                          {getConnectionErrorMessage(ecashStatus.lastError)}
                        </SSText>
                      )}
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
  },
  errorText: {
    paddingTop: 4,
    textAlign: 'left'
  }
})
