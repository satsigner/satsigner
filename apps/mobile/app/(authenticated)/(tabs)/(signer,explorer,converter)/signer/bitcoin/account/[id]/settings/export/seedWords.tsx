import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSPinEntry from '@/components/SSPinEntry'
import SSSeedQR from '@/components/SSSeedQR'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { decryptKeySecret } from '@/utils/account'
import { emptyPin } from '@/utils/pin'

export default function SeedWordsPage() {
  const { id: accountId, keyIndex } = useLocalSearchParams<
    AccountSearchParams & { keyIndex: string }
  >()

  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )

  const [mnemonic, setMnemonic] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [pin, setPin] = useState<string[]>(emptyPin)
  const [showPinEntry, setShowPinEntry] = useState(false)
  const [seedQRModalVisible, setSeedQRModalVisible] = useState(false)
  const [noMnemonicAvailable, setNoMnemonicAvailable] = useState(false)

  const keyIndexNum = parseInt(keyIndex || '0', 10)
  const key = account?.keys[keyIndexNum]

  const decryptMnemonic = useCallback(async () => {
    if (!account || !key) {
      return
    }

    try {
      const secret = await decryptKeySecret(key)
      setMnemonic(secret.mnemonic || '')
      setNoMnemonicAvailable(!secret.mnemonic)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown reason'
      toast.error(`${t('account.seed.unableToDecrypt')}: ${reason}`)
    } finally {
      setShowPinEntry(false)
    }
  }, [account, key])

  async function handlePinEntry() {
    await decryptMnemonic()
  }

  useEffect(() => {
    if (account && key) {
      setIsLoading(false)
      setShowPinEntry(true)
    } else {
      setIsLoading(false)
    }
  }, [
	account,
	key,
	decryptMnemonic
])

  if (isLoading) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter style={{ flex: 1, justifyContent: 'center' }}>
          <SSText>{t('common.loading')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  if (!account || !key) {
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
                  {key.name || `Key ${keyIndexNum + 1}`}
                </SSText>
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
                  <SSButton
                    label={t('account.seed.seedqr.title')}
                    variant="outline"
                    style={{ flex: 0.5 }}
                    onPress={() => setSeedQRModalVisible(true)}
                  />
                  <SSClipboardCopy
                    text={mnemonic.replaceAll(',', ' ')}
                    style={{ flex: 0.5 }}
                  >
                    <SSButton label={t('common.copy')} variant="outline" />
                  </SSClipboardCopy>
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
        mnemonicWordList={account.keys[0]?.mnemonicWordList}
        visible={seedQRModalVisible}
        title={key.name || `Key ${keyIndexNum + 1}`}
        onClose={() => setSeedQRModalVisible(false)}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  mnemonicColumn: {
    flex: 1,
    maxWidth: '32%'
  },
  mnemonicGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    width: '100%'
  },
  mnemonicWordContainer: {
    height: 48,
    marginBottom: 8
  },
  mnemonicWordInnerContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 3
  },
  mnemonicWordsContainer: {
    marginBottom: 16,
    width: '100%'
  },
  wordIndex: {
    lineHeight: 20,
    minWidth: 24,
    textAlign: 'center'
  },
  wordText: {
    flex: 1,
    lineHeight: 20,
    textAlign: 'left'
  }
})
