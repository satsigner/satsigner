import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Modal, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSIconButton from '@/components/SSIconButton'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { generateMnemonic } from '@/utils/bip39'
import { deriveNostrKeysFromMnemonic } from '@/utils/nostrIdentity'

export default function CreateNostrIdentity() {
  const router = useRouter()
  const [showNsec, setShowNsec] = useState(false)
  const [qrModalValue, setQrModalValue] = useState<string | null>(null)

  const mnemonic = useMemo(() => generateMnemonic(12), [])
  const words = useMemo(() => mnemonic.split(' '), [mnemonic])
  const keys = useMemo(
    () => deriveNostrKeysFromMnemonic(mnemonic),
    [mnemonic]
  )

  function handleCopyMnemonic() {
    Clipboard.setStringAsync(mnemonic)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleNext() {
    router.navigate({
      pathname: '/signer/nostr/create/profile',
      params: {
        mnemonic,
        nsec: keys.nsec,
        npub: keys.npub
      }
    })
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.create.title')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.content}>
          {/* Seed Words */}
          <SSVStack gap="sm">
            <SSHStack justifyBetween>
              <SSText size="sm" color="muted" uppercase>
                {t('nostrIdentity.create.seedWords')}
              </SSText>
              <SSButton
                label={t('common.copy')}
                variant="ghost"
                onPress={handleCopyMnemonic}
                style={styles.copyButton}
              />
            </SSHStack>
            <View style={styles.wordsGrid}>
              {words.map((word, index) => (
                <View key={index} style={styles.wordCell}>
                  <SSText size="xs" color="muted" style={styles.wordIndex}>
                    {index + 1}
                  </SSText>
                  <SSText size="sm" type="mono">
                    {word}
                  </SSText>
                </View>
              ))}
            </View>
          </SSVStack>

          {/* nsec */}
          <SSVStack gap="sm">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.create.nsec')}
            </SSText>
            <View style={styles.keyContainer}>
              <SSText
                size="xs"
                type="mono"
                style={styles.keyText}
                numberOfLines={2}
              >
                {showNsec ? keys.nsec : '••••••••••••••••••••••••••••••••'}
              </SSText>
              <SSHStack gap="sm" style={styles.keyActions}>
                <SSButton
                  label={showNsec ? t('common.hide') : t('common.show')}
                  variant="ghost"
                  onPress={() => setShowNsec(!showNsec)}
                  style={styles.keyActionButton}
                />
                <SSClipboardCopy text={keys.nsec}>
                  <SSText size="xs" color="muted">
                    {t('common.copy')}
                  </SSText>
                </SSClipboardCopy>
                <SSIconButton onPress={() => setQrModalValue(keys.nsec)}>
                  <SSText size="xs" color="muted">
                    QR
                  </SSText>
                </SSIconButton>
              </SSHStack>
            </View>
          </SSVStack>

          {/* npub */}
          <SSVStack gap="sm">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.create.npub')}
            </SSText>
            <View style={styles.keyContainer}>
              <SSText
                size="xs"
                type="mono"
                style={styles.keyText}
                numberOfLines={2}
              >
                {keys.npub}
              </SSText>
              <SSHStack gap="sm" style={styles.keyActions}>
                <SSClipboardCopy text={keys.npub}>
                  <SSText size="xs" color="muted">
                    {t('common.copy')}
                  </SSText>
                </SSClipboardCopy>
                <SSIconButton onPress={() => setQrModalValue(keys.npub)}>
                  <SSText size="xs" color="muted">
                    QR
                  </SSText>
                </SSIconButton>
              </SSHStack>
            </View>
          </SSVStack>

          <SSButton
            label={t('nostrIdentity.create.next')}
            variant="secondary"
            onPress={handleNext}
          />
        </SSVStack>
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={qrModalValue !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalValue(null)}
      >
        <View style={styles.qrOverlay}>
          <View style={styles.qrSheet}>
            <SSVStack itemsCenter gap="md">
              {qrModalValue && <SSQRCode value={qrModalValue} size={240} />}
              <SSText size="xs" type="mono" center numberOfLines={3}>
                {qrModalValue}
              </SSText>
              <SSButton
                label={t('common.close')}
                variant="ghost"
                onPress={() => setQrModalValue(null)}
              />
            </SSVStack>
          </View>
        </View>
      </Modal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40
  },
  copyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  keyActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  keyActions: {
    paddingTop: 8
  },
  keyContainer: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  keyText: {
    lineHeight: 18
  },
  qrOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30
  },
  qrSheet: {
    backgroundColor: Colors.gray[950],
    borderRadius: 16,
    padding: 24
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
    justifyContent: 'space-between'
  }
})
