import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import SSIconEyeOff from '@/components/icons/SSIconEyeOff'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import { NOSTR_FALLBACK_NPUB_COLOR } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { generateColorFromNpub } from '@/utils/nostr'
import { truncateNpub } from '@/utils/nostrIdentity'

type KeysParams = {
  npub: string
}

type QrModalContent = {
  type: 'npub' | 'nsec'
  value: string
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

  const npubColor = npub
    ? generateColorFromNpub(npub)
    : NOSTR_FALLBACK_NPUB_COLOR

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
          <SSText color="muted">
            {t('nostrIdentity.account.notFound')}
          </SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  const isWatchOnly = identity.isWatchOnly

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
              <SSText center>{t('nostrIdentity.keys.npub')}</SSText>
              <SSVStack gap="xxs" style={styles.keysContainer}>
                <SSHStack gap="xs" style={styles.npubRow}>
                  <View
                    style={[
                      styles.colorCircle,
                      { backgroundColor: npubColor }
                    ]}
                  />
                  <SSClipboardCopy text={npub} fullWidth={false}>
                    <SSText
                      center
                      size="xl"
                      type="mono"
                      style={styles.keyText}
                      selectable
                    >
                      {truncateNpub(npub, 12)}
                    </SSText>
                  </SSClipboardCopy>
                </SSHStack>
                <SSButton
                  variant="default"
                  label={t('common.showQR')}
                  onPress={() => setQrModal({ type: 'npub', value: npub })}
                  style={styles.showQrButton}
                />
              </SSVStack>
            </SSVStack>

            {identity.nsec && (
              <SSVStack gap="sm">
                <SSText center>{t('nostrIdentity.keys.nsec')}</SSText>
                <SSVStack gap="xxs" style={styles.keysContainer}>
                  {nsecRevealed ? (
                    <>
                      <SSClipboardCopy text={identity.nsec}>
                        <SSText
                          center
                          size="xl"
                          type="mono"
                          style={styles.keyText}
                          selectable
                        >
                          {truncateNpub(identity.nsec, 12)}
                        </SSText>
                      </SSClipboardCopy>
                      <SSButton
                        variant="default"
                        label={t('common.showQR')}
                        onPress={() =>
                          setQrModal({
                            type: 'nsec',
                            value: identity.nsec!
                          })
                        }
                        style={styles.showQrButton}
                      />
                      <Pressable
                        onPress={() => setNsecRevealed(false)}
                        style={styles.revealRow}
                      >
                        <SSIconEyeOn
                          stroke={Colors.white}
                          height={18}
                          width={18}
                        />
                        <SSText color="muted">{t('common.hide')}</SSText>
                      </Pressable>
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
                        ••••••••••••••••
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
                        {identity.mnemonic.split(' ').map((word, index) => (
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
                        ))}
                      </View>
                      <SSClipboardCopy text={identity.mnemonic}>
                        <SSText size="xs" color="muted" center>
                          {t('common.copy')}
                        </SSText>
                      </SSClipboardCopy>
                      <Pressable
                        onPress={() => setSeedWordsRevealed(false)}
                        style={styles.revealRow}
                      >
                        <SSIconEyeOn
                          stroke={Colors.white}
                          height={18}
                          width={18}
                        />
                        <SSText color="muted">{t('common.hide')}</SSText>
                      </Pressable>
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
                        ••••••••••••••••
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
                <SSText
                  type="mono"
                  size="sm"
                  selectable
                  style={styles.qrModalDataText}
                >
                  {qrModal.value}
                </SSText>
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
  keyText: {
    letterSpacing: 1
  },
  keysContainer: {
    backgroundColor: '#1a1a1a',
    borderColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    paddingBottom: 20,
    paddingHorizontal: 28
  },
  mainLayout: {
    paddingBottom: 20,
    paddingTop: 10
  },
  npubRow: {
    alignItems: 'center',
    alignSelf: 'center'
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
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  scrollView: {
    flex: 1
  },
  showQrButton: {
    marginTop: 20
  },
  wordCell: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '48%'
  },
  wordIndex: {
    minWidth: 16
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
    marginVertical: 8
  }
})
