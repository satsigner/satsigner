import { Stack } from 'expo-router'
import { useState } from 'react'
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
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

const DEFAULT_MINTS = [
  { name: 'Bitcoin Minibits mint', url: 'https://mint.minibits.cash/Bitcoin' },
  { name: 'Mint Cuba Bitcoin', url: 'https://mint.cubabitcoin.org' },
  { name: 'Voltz Mint', url: 'https://mint.lnvoltz.com' },
  { name: '21Mint', url: 'https://21mint.me' },
  { name: 'Coinos', url: 'https://mint.coinos.io' }
]

export default function EcashAccountMintPage() {
  const [mintUrl, setMintUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [recoveringMintUrl, setRecoveringMintUrl] = useState<string | null>(
    null
  )

  const {
    activeAccount,
    mints,
    connectToMint,
    disconnectMint,
    restoreFromSeed
  } = useEcash()

  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
  const zeroPadding = useZeroPadding || currencyUnit === 'btc'

  async function handleConnectMint() {
    if (!mintUrl) {
      toast.error(t('ecash.mint.enterUrl'))
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
  }

  function handleSelectDefaultMint(url: string) {
    setMintUrl(url)
  }

  function handleRemoveMint(url: string) {
    disconnectMint(url)
  }

  async function handleRecoverFromMint(url: string) {
    setRecoveringMintUrl(url)
    try {
      const result = await restoreFromSeed(url)
      if (result.proofsFound > 0) {
        toast.success(
          t('ecash.recovery.totalAmount', {
            amount: result.totalAmount.toString()
          })
        )
      } else {
        toast.info(t('ecash.info.noProofsFound'))
      }
    } catch {
      toast.error(t('ecash.recovery.restoreFailed', { error: '' }))
    } finally {
      setRecoveringMintUrl(null)
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ecash.mint.title')}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack gap="lg">
          {mints.length > 0 && (
            <SSVStack gap="md">
              <SSText uppercase>{t('ecash.mint.connectedMints')}</SSText>
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
                    {activeAccount?.hasSeed && (
                      <SSButton
                        label={t('ecash.mint.recover')}
                        onPress={() => handleRecoverFromMint(mint.url)}
                        loading={recoveringMintUrl === mint.url}
                        variant="outline"
                        style={styles.recoverButton}
                      />
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

          {mints.length === 0 && (
            <SSVStack gap="md" style={styles.emptyState}>
              <SSText color="muted" center>
                {t('ecash.mint.noMintSelectedDescription')}
              </SSText>
            </SSVStack>
          )}

          <SSVStack gap="md">
            <SSVStack gap="xs">
              <SSText uppercase>{t('ecash.mint.addMint')}</SSText>
              <SSTextInput
                value={mintUrl}
                onChangeText={setMintUrl}
                placeholder="https://mint.example.com"
                keyboardType="url"
              />
            </SSVStack>
            <SSButton
              label={t('ecash.mint.connect')}
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
  defaultMintButton: {
    marginBottom: 2,
    opacity: 0.7
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40
  },
  mintCard: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16
  },
  recoverButton: {
    marginTop: 8
  },
  removeButton: {
    marginTop: 4
  }
})
