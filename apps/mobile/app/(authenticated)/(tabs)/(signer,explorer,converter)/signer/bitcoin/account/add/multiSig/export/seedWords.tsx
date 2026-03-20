import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSPinEntry from '@/components/SSPinEntry'
import SSSeedQR from '@/components/SSSeedQR'
import SSText from '@/components/SSText'
import { PIN_KEY } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAuthStore } from '@/store/auth'
import { Colors } from '@/styles'
import { aesDecrypt } from '@/utils/crypto'

export default function SeedWordsPage() {
  const { keyIndex } = useLocalSearchParams<{ keyIndex: string }>()

  const [getAccountData] = useAccountBuilderStore(
    useShallow((state) => [state.getAccountData])
  )
  const skipPin = useAuthStore((state) => state.skipPin)

  const [mnemonic, setMnemonic] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [pin, setPin] = useState<string[]>(Array(4).fill(''))
  const [showPinEntry, setShowPinEntry] = useState(false)
  const [seedQRModalVisible, setSeedQRModalVisible] = useState(false)
  const [noMnemonicAvailable, setNoMnemonicAvailable] = useState(false)

  const keyIndexNum = parseInt(keyIndex || '0', 10)
  const accountData = getAccountData()
  const key = accountData?.keys[keyIndexNum]

  const decryptMnemonic = useCallback(async () => {
    if (!accountData || !key) return

    try {
      // During multisig creation, the secret is stored in plain text
      // Check if the secret is an object with mnemonic (creation mode)
      if (typeof key.secret === 'object' && key.secret.mnemonic) {
        // In creation mode, mnemonic is stored in plain text
        setMnemonic(key.secret.mnemonic)
        setShowPinEntry(false)
        return
      }

      // For encrypted secrets (settings mode), we need PIN
      // Always use the stored PIN for decryption, not the default PIN
      const pinHash = await getItem(PIN_KEY)
      if (!pinHash) {
        toast.error(t('account.seed.unableToDecrypt'))
        return
      }

      // Check if the secret is encrypted (string)
      if (typeof key.secret === 'string') {
        // Decrypt the key's secret
        const decryptedSecretString = await aesDecrypt(
          key.secret,
          pinHash,
          key.iv
        )
        const decryptedSecret = JSON.parse(decryptedSecretString)

        if (decryptedSecret.mnemonic) {
          setMnemonic(decryptedSecret.mnemonic)
          setShowPinEntry(false)

          // Clear sensitive data from memory
          decryptedSecret.mnemonic = ''
        } else {
          setNoMnemonicAvailable(true)
          setShowPinEntry(false)
        }
      } else {
        setNoMnemonicAvailable(true)
        setShowPinEntry(false)
      }
    } catch (_error) {
      toast.error(t('account.seed.unableToDecrypt'))
    }
  }, [accountData, key])

  async function handlePinEntry() {
    await decryptMnemonic()
  }

  useEffect(() => {
    if (accountData && key) {
      setIsLoading(false)

      // Check if we're in creation mode (plain text mnemonic)
      if (typeof key.secret === 'object' && key.secret.mnemonic) {
        // In creation mode, no PIN needed - directly show mnemonic
        setMnemonic(key.secret.mnemonic)
        setShowPinEntry(false)
      } else if (skipPin) {
        // Automatically decrypt when skip PIN is enabled (settings mode)
        decryptMnemonic()
      } else {
        // Show PIN entry when skip PIN is disabled (settings mode)
        setShowPinEntry(true)
      }
    } else {
      setIsLoading(false)
    }
  }, [accountData, key, skipPin, decryptMnemonic])

  if (isLoading) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter style={{ flex: 1, justifyContent: 'center' }}>
          <SSText>{t('common.loading')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  if (!accountData || !key) {
    return <Redirect href="/" />
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {t('account.seed.viewSeedWords')} -{' '}
              {key.name || `Key ${keyIndexNum + 1}`}
            </SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={{ padding: 16 }}>
          {noMnemonicAvailable ? (
            <SSVStack
              itemsCenter
              style={{ flex: 1, justifyContent: 'center' }}
              gap="lg"
            >
              <SSText center color="muted">
                {t('account.seed.noSeedAvailable')}
              </SSText>
              <SSButton
                label={t('common.back')}
                onPress={() => router.back()}
              />
            </SSVStack>
          ) : mnemonic ? (
            <>
              <SSVStack gap="md">
                <SSText center uppercase>
                  {key.mnemonicWordCount} {t('account.mnemonic.title')} (
                  {key.mnemonicWordList?.replaceAll('_', ' ')})
                </SSText>
                <SSHStack style={{ justifyContent: 'center' }}>
                  <SSText uppercase color="muted">
                    {t('account.seed.keepItSecret')}
                  </SSText>
                </SSHStack>
              </SSVStack>

              <View style={styles.mnemonicWordsContainer}>
                <SSSeedLayout count={key.mnemonicWordCount || 24}>
                  <View style={styles.mnemonicGrid}>
                    {Array.from({ length: 3 }).map((_, colIndex) => {
                      const totalWords = key.mnemonicWordCount || 24
                      const wordsPerColumn = Math.ceil(totalWords / 3)
                      const isLastColumn = colIndex === 2
                      const wordsInThisColumn = isLastColumn
                        ? totalWords - wordsPerColumn * 2 // Handle remainder in last column
                        : wordsPerColumn

                      return (
                        <View key={colIndex} style={styles.mnemonicColumn}>
                          {Array.from({ length: wordsPerColumn }).map(
                            (_, rowIndex) => {
                              const wordIndex =
                                colIndex * wordsPerColumn + rowIndex
                              const words = mnemonic.split(' ')
                              const word =
                                wordIndex < words.length &&
                                rowIndex < wordsInThisColumn
                                  ? words[wordIndex]
                                  : null

                              return word ? (
                                <View
                                  key={rowIndex}
                                  style={styles.mnemonicWordContainer}
                                >
                                  <SSHStack
                                    style={styles.mnemonicWordInnerContainer}
                                    gap="sm"
                                  >
                                    <SSText
                                      size="sm"
                                      color="muted"
                                      style={styles.wordIndex}
                                    >
                                      {(wordIndex + 1)
                                        .toString()
                                        .padStart(2, '0')}
                                    </SSText>
                                    <SSText size="md" style={styles.wordText}>
                                      {word}
                                    </SSText>
                                  </SSHStack>
                                </View>
                              ) : null
                            }
                          )}
                        </View>
                      )
                    })}
                  </View>
                </SSSeedLayout>
              </View>
              <SSVStack gap="sm" style={{ paddingTop: 32 }}>
                <SSHStack gap="sm">
                  <SSClipboardCopy
                    text={mnemonic.replaceAll(',', ' ')}
                    style={{ flex: 0.5 }}
                  >
                    <SSButton label={t('common.copy')} variant="outline" />
                  </SSClipboardCopy>
                  <SSButton
                    label={t('account.seed.seedqr.title')}
                    variant="outline"
                    style={{ flex: 0.5 }}
                    onPress={() => setSeedQRModalVisible(true)}
                  />
                </SSHStack>
                <SSButton
                  label={t('common.back')}
                  variant="ghost"
                  onPress={() => router.back()}
                />
              </SSVStack>
            </>
          ) : (
            <SSVStack
              itemsCenter
              style={{ flex: 1, justifyContent: 'center' }}
              gap="lg"
            >
              <SSText center color="muted">
                {t('account.seed.enterPinToView')}
              </SSText>
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
      <SSModal visible={showPinEntry} onClose={() => setShowPinEntry(false)}>
        <SSPinEntry
          title={t('account.enter.pin')}
          pin={pin}
          setPin={setPin}
          onFillEnded={handlePinEntry}
        />
      </SSModal>
      <SSSeedQR
        mnemonic={mnemonic}
        mnemonicWordList={key?.mnemonicWordList || 'english'}
        visible={seedQRModalVisible}
        title={key.name || `Key ${keyIndexNum + 1}`}
        onClose={() => setSeedQRModalVisible(false)}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  mnemonicGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 8
  },
  mnemonicColumn: {
    flex: 1,
    maxWidth: '32%'
  },
  mnemonicWordContainer: {
    marginBottom: 8,
    height: 48
  },
  mnemonicWordInnerContainer: {
    flex: 1,
    padding: 3,
    borderRadius: 8,
    borderColor: Colors.gray[800],
    borderWidth: 1,
    backgroundColor: Colors.gray[900],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  wordIndex: {
    minWidth: 24,
    textAlign: 'center',
    lineHeight: 20
  },
  wordText: {
    flex: 1,
    textAlign: 'left',
    lineHeight: 20
  },
  mnemonicWordsContainer: {
    width: '100%',
    marginBottom: 16
  }
})
