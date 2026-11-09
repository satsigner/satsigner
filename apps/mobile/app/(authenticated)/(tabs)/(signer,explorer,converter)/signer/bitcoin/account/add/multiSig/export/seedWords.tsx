import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSPinAuth from '@/components/SSPinAuth'
import SSScreenCaptureGuard from '@/components/SSScreenCaptureGuard'
import SSSeedQR from '@/components/SSSeedQR'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { Colors } from '@/styles'
import { type Key } from '@/types/models/Account'
import { decryptAccountKeySecret, decryptKeySecret } from '@/utils/decryption'

// The PIN is asked once per visit; a key still holding its plaintext seed
// (before the account is created) needs no PIN at all.
type SecretReveal =
  | { status: 'locked' }
  | { status: 'dismissed' }
  | { status: 'revealed'; mnemonic: string }
  | { status: 'empty' }

function getInitialReveal(key: Key | undefined): SecretReveal {
  if (typeof key?.secret === 'object' && key.secret.mnemonic) {
    return { mnemonic: key.secret.mnemonic, status: 'revealed' }
  }
  return { status: 'locked' }
}

async function revealMnemonic(
  accountId: string,
  key: Key
): Promise<SecretReveal> {
  const decryptedSecret = key.secret
    ? await decryptKeySecret(key)
    : await decryptAccountKeySecret(accountId, key.index)
  return decryptedSecret.mnemonic
    ? { mnemonic: decryptedSecret.mnemonic, status: 'revealed' }
    : { status: 'empty' }
}

export default function SeedWordsPage() {
  const { keyIndex } = useLocalSearchParams<{ keyIndex: string }>()

  const [getAccountData] = useAccountBuilderStore(
    useShallow((state) => [state.getAccountData])
  )

  const keyIndexNum = Number.parseInt(keyIndex || '0', 10)
  const accountData = getAccountData()
  const key = accountData?.keys[keyIndexNum]

  const [reveal, setReveal] = useState(() => getInitialReveal(key))
  const [seedQRModalVisible, setSeedQRModalVisible] = useState(false)
  const mnemonic = reveal.status === 'revealed' ? reveal.mnemonic : ''
  const noMnemonicAvailable = reveal.status === 'empty'

  async function handleSuccessPin() {
    if (!accountData || !key) {
      return
    }
    try {
      setReveal(await revealMnemonic(accountData.id, key))
    } catch {
      toast.error(t('account.seed.unableToDecrypt'))
      setReveal({ status: 'dismissed' })
    }
  }

  function handlePinTriesOver() {
    router.back()
  }

  if (!accountData || !key) {
    return <Redirect href="/" />
  }

  return (
    <SSMainLayout>
      <SSScreenCaptureGuard />
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
      <SSModal
        visible={reveal.status === 'locked'}
        fullOpacity
        onClose={() => setReveal({ status: 'dismissed' })}
      >
        <SSPinAuth
          title={t('account.enter.pin')}
          onSuccess={handleSuccessPin}
          onTriesOver={handlePinTriesOver}
          maxTries={3}
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
