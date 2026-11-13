import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSIconEyeOff from '@/components/icons/SSIconEyeOff'
import SSButton from '@/components/SSButton'
import SSNostrKeyFormatTabs from '@/components/SSNostrKeyFormatTabs'
import SSNostrKeyQRModal from '@/components/SSNostrKeyQRModal'
import SSScreenCaptureGuard from '@/components/SSScreenCaptureGuard'
import SSSeedQR from '@/components/SSSeedQR'
import SSShadedKeyText from '@/components/SSShadedKeyText'
import SSText from '@/components/SSText'
import {
  NOSTR_HIDDEN_KEY_MASK,
  NOSTR_KEY_LINE_BREAK_EVERY
} from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors, Sizes } from '@/styles'
import { chunkArray } from '@/utils/chunkArray'
import {
  formatNostrKey,
  generateColorFromNpub,
  getNostrKeyLabel,
  type NostrKeyFormat,
  type NostrKeyType
} from '@/utils/nostr'

type KeysParams = {
  npub: string
}

const SEED_WORDS_PER_ROW = 3
const EYE_ICON_SIZE = 18

function copyToClipboard(value: string) {
  Clipboard.setStringAsync(value)
  toast.success(t('common.copiedToClipboard'))
}

export default function NostrIdentityKeys() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<KeysParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )

  const [keyFormat, setKeyFormat] = useState<NostrKeyFormat>('bech32')
  const [nsecRevealed, setNsecRevealed] = useState(false)
  const [seedWordsRevealed, setSeedWordsRevealed] = useState(false)
  const [qrKeyType, setQrKeyType] = useState<NostrKeyType | null>(null)
  const [seedQrVisible, setSeedQrVisible] = useState(false)

  if (!identity) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('nostrIdentity.keys.title')}</SSText>
            )
          }}
        />
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  const { isWatchOnly, mnemonic } = identity
  const npubColor = generateColorFromNpub(identity.npub)
  const npubDisplay = formatNostrKey(identity.npub, keyFormat) ?? identity.npub
  const nsecDisplay = identity.nsec
    ? formatNostrKey(identity.nsec, keyFormat)
    : null
  const qrValue = qrKeyType === 'nsec' ? identity.nsec : identity.npub
  const isSecretRevealed = nsecRevealed || seedWordsRevealed

  function handleCopyNpub() {
    copyToClipboard(npubDisplay)
  }

  function handleCopyNsec() {
    if (!nsecDisplay) {
      return
    }
    copyToClipboard(nsecDisplay)
  }

  function handleCopyMnemonic() {
    if (!mnemonic) {
      return
    }
    copyToClipboard(mnemonic)
  }

  function handleShowNpubQr() {
    setQrKeyType('npub')
  }

  function handleShowNsecQr() {
    setQrKeyType('nsec')
  }

  function handleCloseQr() {
    setQrKeyType(null)
  }

  function handleRevealNsec() {
    setNsecRevealed(true)
  }

  function handleHideNsec() {
    setNsecRevealed(false)
  }

  function handleRevealSeedWords() {
    setSeedWordsRevealed(true)
  }

  function handleHideSeedWords() {
    setSeedWordsRevealed(false)
  }

  function handleShowSeedQr() {
    setSeedQrVisible(true)
  }

  function handleCloseSeedQr() {
    setSeedQrVisible(false)
  }

  function handleBack() {
    router.back()
  }

  return (
    <SSMainLayout style={styles.mainLayout}>
      {isSecretRevealed && <SSScreenCaptureGuard />}
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.keys.title')}</SSText>
          )
        }}
      />
      <SSVStack style={styles.pageContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="lg">
            <SSNostrKeyFormatTabs format={keyFormat} onChange={setKeyFormat} />

            <SSVStack gap="sm">
              <SSHStack gap="xs" style={styles.npubLabelRow}>
                <View
                  style={[styles.colorCircle, { backgroundColor: npubColor }]}
                />
                <SSText center>{getNostrKeyLabel('npub', keyFormat)}</SSText>
              </SSHStack>
              <SSVStack gap="xxs" style={styles.keysContainer}>
                <SSShadedKeyText
                  value={npubDisplay}
                  lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
                />
                <SSHStack gap="sm" style={styles.keyActionsRow}>
                  <SSButton
                    label={t('common.copy')}
                    onPress={handleCopyNpub}
                    style={styles.keyActionButton}
                    variant="outline"
                  />
                  <SSButton
                    label={t('common.showQR')}
                    onPress={handleShowNpubQr}
                    style={styles.keyActionButton}
                    variant="outline"
                  />
                </SSHStack>
              </SSVStack>
            </SSVStack>

            {nsecDisplay && (
              <SSVStack gap="sm">
                <SSText center>{getNostrKeyLabel('nsec', keyFormat)}</SSText>
                <SSVStack gap="xxs" style={styles.keysContainer}>
                  {nsecRevealed ? (
                    <>
                      <SSShadedKeyText
                        value={nsecDisplay}
                        lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
                      />
                      <SSHStack gap="sm" style={styles.keyActionsRow}>
                        <SSButton
                          label={t('common.copy')}
                          onPress={handleCopyNsec}
                          style={styles.keyActionButton}
                          variant="outline"
                        />
                        <SSButton
                          label={t('common.showQR')}
                          onPress={handleShowNsecQr}
                          style={styles.keyActionButton}
                          variant="outline"
                        />
                        <SSButton
                          label={t('common.hide')}
                          onPress={handleHideNsec}
                          style={styles.keyActionButton}
                          variant="outline"
                        />
                      </SSHStack>
                    </>
                  ) : (
                    <Pressable
                      onPress={handleRevealNsec}
                      style={styles.revealRow}
                    >
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.maskText}
                      >
                        {NOSTR_HIDDEN_KEY_MASK}
                      </SSText>
                      <SSIconEyeOff
                        height={EYE_ICON_SIZE}
                        width={EYE_ICON_SIZE}
                      />
                    </Pressable>
                  )}
                </SSVStack>
              </SSVStack>
            )}

            {mnemonic && (
              <SSVStack gap="sm">
                <SSText center>{t('nostrIdentity.keys.seedWords')}</SSText>
                <SSVStack gap="xxs" style={styles.keysContainer}>
                  {seedWordsRevealed ? (
                    <>
                      <View style={styles.wordsGrid}>
                        {chunkArray(
                          mnemonic.split(' '),
                          SEED_WORDS_PER_ROW
                        ).map((row, rowIndex) => (
                          <SSHStack
                            key={rowIndex}
                            gap="sm"
                            style={styles.wordRow}
                          >
                            {row.map((word, colIndex) => {
                              const index =
                                rowIndex * SEED_WORDS_PER_ROW + colIndex
                              return (
                                <View key={index} style={styles.wordCell}>
                                  <SSText
                                    size="xs"
                                    color="muted"
                                    style={styles.wordIndex}
                                  >
                                    {index + 1}
                                  </SSText>
                                  <SSText size="sm" type="mono">
                                    {word}
                                  </SSText>
                                </View>
                              )
                            })}
                          </SSHStack>
                        ))}
                      </View>
                      <SSHStack gap="sm" style={styles.keyActionsRow}>
                        <SSButton
                          label={t('common.copy')}
                          onPress={handleCopyMnemonic}
                          style={styles.keyActionButton}
                          variant="outline"
                        />
                        <SSButton
                          label={t('account.seed.seedqr.title')}
                          onPress={handleShowSeedQr}
                          style={styles.keyActionButton}
                          variant="outline"
                        />
                        <SSButton
                          label={t('common.hide')}
                          onPress={handleHideSeedWords}
                          style={styles.keyActionButton}
                          variant="outline"
                        />
                      </SSHStack>
                    </>
                  ) : (
                    <Pressable
                      onPress={handleRevealSeedWords}
                      style={styles.revealRow}
                    >
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.maskText}
                      >
                        {NOSTR_HIDDEN_KEY_MASK}
                      </SSText>
                      <SSIconEyeOff
                        height={EYE_ICON_SIZE}
                        width={EYE_ICON_SIZE}
                      />
                    </Pressable>
                  )}
                </SSVStack>
              </SSVStack>
            )}

            {isWatchOnly && (
              <SSText center color="muted" size="sm">
                {t('nostrIdentity.keys.watchOnly')}
              </SSText>
            )}

            <SSButton
              variant="ghost"
              label={t('common.back')}
              onPress={handleBack}
              style={styles.backButton}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>

      {mnemonic ? (
        <SSSeedQR
          mnemonic={mnemonic}
          visible={seedQrVisible}
          onClose={handleCloseSeedQr}
        />
      ) : null}

      {qrKeyType && qrValue ? (
        <SSNostrKeyQRModal
          value={qrValue}
          lnAddress={qrKeyType === 'npub' ? identity.lud16 : undefined}
          ownerNpub={identity.npub}
          shareable={qrKeyType === 'npub'}
          visible
          onClose={handleCloseQr}
        />
      ) : null}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  backButton: {
    marginTop: 8
  },
  colorCircle: {
    borderRadius: 5,
    height: 10,
    width: 10
  },
  emptyContainer: {
    paddingVertical: 60
  },
  keyActionButton: {
    flex: 1,
    minWidth: 0
  },
  keyActionsRow: {
    alignSelf: 'stretch',
    marginTop: 12,
    width: '100%'
  },
  keysContainer: {
    alignSelf: 'stretch',
    width: '100%'
  },
  mainLayout: {
    paddingBottom: 20,
    paddingTop: 10
  },
  maskText: {
    letterSpacing: 1
  },
  npubLabelRow: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: '100%'
  },
  pageContainer: {
    flex: 1
  },
  revealRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 8
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  scrollView: {
    flex: 1
  },
  wordCell: {
    alignItems: 'center',
    backgroundColor: Colors.black,
    borderColor: Colors.gray[800],
    borderRadius: Sizes.wordInput.borderRadius,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  wordIndex: {
    minWidth: 16
  },
  wordRow: {
    alignItems: 'stretch',
    alignSelf: 'stretch'
  },
  wordsGrid: {
    gap: 6,
    marginVertical: 4
  }
})
