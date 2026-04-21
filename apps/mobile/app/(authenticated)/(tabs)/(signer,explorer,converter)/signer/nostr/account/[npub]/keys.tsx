import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { type ReactNode, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View
} from 'react-native'
import { toast } from 'sonner-native'

import SSIconEyeOff from '@/components/icons/SSIconEyeOff'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSSeedQR from '@/components/SSSeedQR'
import SSText from '@/components/SSText'
import { NOSTR_HIDDEN_KEY_MASK } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors, Sizes, Typography } from '@/styles'
import { chunkArray } from '@/utils/chunkArray'
import { generateColorFromNpub } from '@/utils/nostr'

type KeysParams = {
  npub: string
}

type QrModalContent = {
  type: 'npub' | 'nsec'
  value: string
}

const NOSTR_KEY_SHADE_CHUNK = 4
const NOSTR_KEY_LINE_BREAK_EVERY = 28

type ShadedNostrKeyTextProps = {
  value: string
  size?: 'sm' | 'xl'
  style?: StyleProp<TextStyle>
  lineBreakEvery?: number
}

function ShadedNostrKeyText({
  value,
  size = 'xl',
  style,
  lineBreakEvery
}: ShadedNostrKeyTextProps) {
  const trimmed = value.trim()
  const fontSize = Sizes.text.fontSize[size]
  const baseTextStyle: TextStyle = {
    fontFamily: Typography.sfProMono,
    fontSize,
    letterSpacing: 1,
    lineHeight: Math.round(fontSize * 1.45),
    textAlign: 'center'
  }

  function renderShadedChunks(
    segment: string,
    globalChunkOffset: number
  ): ReactNode {
    const parts: ReactNode[] = []
    for (let j = 0; j < segment.length; j += NOSTR_KEY_SHADE_CHUNK) {
      const chunk = segment.slice(j, j + NOSTR_KEY_SHADE_CHUNK)
      const globalChunkIndex = globalChunkOffset + j / NOSTR_KEY_SHADE_CHUNK
      parts.push(
        <Text
          key={`${globalChunkIndex}-${chunk}`}
          style={{
            color: globalChunkIndex % 2 === 0 ? Colors.white : Colors.gray[200]
          }}
        >
          {chunk}
        </Text>
      )
    }
    return parts
  }

  if (!lineBreakEvery || lineBreakEvery <= 0) {
    return (
      <Text selectable style={[baseTextStyle, style]}>
        {renderShadedChunks(trimmed, 0)}
      </Text>
    )
  }

  const lines: string[] = []
  for (let i = 0; i < trimmed.length; i += lineBreakEvery) {
    lines.push(trimmed.slice(i, i + lineBreakEvery))
  }

  return (
    <Text selectable style={[baseTextStyle, style]}>
      {lines.map((line, lineIdx) => {
        const lineStartChar = lineIdx * lineBreakEvery
        const globalChunkOffset = lineStartChar / NOSTR_KEY_SHADE_CHUNK
        return (
          <Text key={lineIdx}>
            {renderShadedChunks(line, globalChunkOffset)}
            {lineIdx < lines.length - 1 ? '\n' : ''}
          </Text>
        )
      })}
    </Text>
  )
}

export default function NostrIdentityKeys() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<KeysParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )

  const [nsecRevealed, setNsecRevealed] = useState(false)
  const [seedWordsRevealed, setSeedWordsRevealed] = useState(false)
  const [qrModal, setQrModal] = useState<QrModalContent | null>(null)
  const [seedQrVisible, setSeedQrVisible] = useState(false)

  function handleCopyNpub() {
    const value = identity?.npub ?? (Array.isArray(npub) ? npub[0] : npub)
    if (!value) {
      return
    }
    Clipboard.setStringAsync(value)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleCopyNsec() {
    if (!identity?.nsec) {
      return
    }
    Clipboard.setStringAsync(identity.nsec)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleCopyMnemonic() {
    if (!identity?.mnemonic) {
      return
    }
    Clipboard.setStringAsync(identity.mnemonic)
    toast.success(t('common.copiedToClipboard'))
  }

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

  const { isWatchOnly } = identity
  const npubColor = generateColorFromNpub(identity.npub)

  return (
    <SSMainLayout style={styles.mainLayout}>
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
            <SSVStack gap="sm">
              <SSHStack gap="xs" style={styles.npubLabelRow}>
                <View
                  style={[styles.colorCircle, { backgroundColor: npubColor }]}
                />
                <SSText center>{t('nostrIdentity.keys.npub')}</SSText>
              </SSHStack>
              <SSVStack gap="xxs" style={styles.keysContainer}>
                <ShadedNostrKeyText
                  value={identity.npub}
                  lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
                  style={styles.keyText}
                />
                <SSHStack gap="sm" style={styles.keyActionsRow}>
                  <SSButton
                    label={t('common.copy')}
                    onPress={handleCopyNpub}
                    style={styles.keyActionButtonFlex}
                    variant="outline"
                  />
                  <SSButton
                    label={t('common.showQR')}
                    onPress={() =>
                      setQrModal({ type: 'npub', value: identity.npub })
                    }
                    style={styles.keyActionButtonFlex}
                    variant="outline"
                  />
                </SSHStack>
              </SSVStack>
            </SSVStack>

            {identity.nsec && (
              <SSVStack gap="sm">
                <SSText center>{t('nostrIdentity.keys.nsec')}</SSText>
                <SSVStack gap="xxs" style={styles.keysContainer}>
                  {nsecRevealed ? (
                    <>
                      <ShadedNostrKeyText
                        value={identity.nsec}
                        lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
                        style={styles.keyText}
                      />
                      <SSHStack gap="sm" style={styles.keyActionsRow}>
                        <SSButton
                          label={t('common.copy')}
                          onPress={handleCopyNsec}
                          style={styles.keyActionButtonFlex}
                          variant="outline"
                        />
                        <SSButton
                          label={t('common.showQR')}
                          onPress={() =>
                            setQrModal({
                              type: 'nsec',
                              value: identity.nsec!
                            })
                          }
                          style={styles.keyActionButtonFlex}
                          variant="outline"
                        />
                        <SSButton
                          label={t('common.hide')}
                          onPress={() => setNsecRevealed(false)}
                          style={styles.keyActionButtonFlex}
                          variant="outline"
                        />
                      </SSHStack>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => setNsecRevealed(true)}
                      style={styles.revealRow}
                    >
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.keyText}
                      >
                        {NOSTR_HIDDEN_KEY_MASK}
                      </SSText>
                      <SSIconEyeOff height={18} width={18} />
                    </Pressable>
                  )}
                </SSVStack>
              </SSVStack>
            )}

            {identity.mnemonic && (
              <SSVStack gap="sm">
                <SSText center>{t('nostrIdentity.keys.seedWords')}</SSText>
                <SSVStack gap="xxs" style={styles.keysContainer}>
                  {seedWordsRevealed ? (
                    <>
                      <View style={styles.wordsGrid}>
                        {chunkArray(identity.mnemonic.split(' '), 3).map(
                          (row, rowIndex) => (
                            <SSHStack
                              key={rowIndex}
                              gap="sm"
                              style={styles.wordRow}
                            >
                              {row.map((word, colIndex) => {
                                const index = rowIndex * 3 + colIndex
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
                          )
                        )}
                      </View>
                      <SSHStack gap="sm" style={styles.keyActionsRow}>
                        <SSButton
                          label={t('common.copy')}
                          onPress={handleCopyMnemonic}
                          style={styles.keyActionButtonFlex}
                          variant="outline"
                        />
                        <SSButton
                          label={t('account.seed.seedqr.title')}
                          onPress={() => setSeedQrVisible(true)}
                          style={styles.keyActionButtonFlex}
                          variant="outline"
                        />
                        <SSButton
                          label={t('common.hide')}
                          onPress={() => setSeedWordsRevealed(false)}
                          style={styles.keyActionButtonFlex}
                          variant="outline"
                        />
                      </SSHStack>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => setSeedWordsRevealed(true)}
                      style={styles.revealRow}
                    >
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.keyText}
                      >
                        {NOSTR_HIDDEN_KEY_MASK}
                      </SSText>
                      <SSIconEyeOff height={18} width={18} />
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
              onPress={() => router.back()}
              style={styles.backButton}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>

      {identity.mnemonic ? (
        <SSSeedQR
          mnemonic={identity.mnemonic}
          visible={seedQrVisible}
          onClose={() => setSeedQrVisible(false)}
        />
      ) : null}

      <SSModal
        visible={qrModal !== null}
        fullOpacity
        onClose={() => setQrModal(null)}
        label={t('common.cancel')}
      >
        <SSVStack gap="lg" style={styles.qrModalContent}>
          {qrModal && (
            <>
              <SSText center uppercase>
                {qrModal.type === 'npub'
                  ? t('nostrIdentity.keys.npub')
                  : t('nostrIdentity.keys.nsec')}
              </SSText>
              <View style={styles.qrCodeWrapper}>
                <SSQRCode
                  value={qrModal.value}
                  size={220}
                  color={Colors.white}
                  backgroundColor={Colors.gray[950]}
                  ecl="H"
                />
              </View>
              <View style={styles.qrModalDataBox}>
                <ShadedNostrKeyText
                  value={qrModal.value}
                  size="sm"
                  lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
                  style={styles.qrModalDataText}
                />
              </View>
            </>
          )}
        </SSVStack>
      </SSModal>
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
  keyActionButtonFlex: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 10
  },
  keyActionsRow: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    marginTop: 12,
    width: '100%'
  },
  keyText: {
    letterSpacing: 1
  },
  keysContainer: {
    alignSelf: 'stretch',
    width: '100%'
  },
  mainLayout: {
    paddingBottom: 20,
    paddingTop: 10
  },
  npubLabelRow: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: '100%'
  },
  pageContainer: {
    flex: 1
  },
  qrCodeWrapper: {
    backgroundColor: Colors.gray[950],
    borderRadius: 10,
    padding: 16
  },
  qrModalContent: {
    alignItems: 'center',
    paddingHorizontal: 16
  },
  qrModalDataBox: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    maxWidth: '100%',
    padding: 12
  },
  qrModalDataText: {
    textAlign: 'center'
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
