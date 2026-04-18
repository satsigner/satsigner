import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Modal, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSQRCode from '@/components/SSQRCode'
import SSSeedQR from '@/components/SSSeedQR'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import { generateMnemonic } from '@/utils/bip39'
import { deriveNostrKeysFromMnemonic } from '@/utils/nostrIdentity'

function chunkSeedWords(words: string[], size: number): string[][] {
  const rows: string[][] = []
  for (let i = 0; i < words.length; i += size) {
    rows.push(words.slice(i, i + size))
  }
  return rows
}

export default function CreateNostrIdentity() {
  const router = useRouter()
  const [showNsec, setShowNsec] = useState(false)
  const [qrModalValue, setQrModalValue] = useState<string | null>(null)
  const [seedQrVisible, setSeedQrVisible] = useState(false)

  const mnemonic = useMemo(() => generateMnemonic(12), [])
  const words = useMemo(() => mnemonic.split(' '), [mnemonic])
  const keys = useMemo(() => deriveNostrKeysFromMnemonic(mnemonic), [mnemonic])

  function handleCopyMnemonic() {
    Clipboard.setStringAsync(mnemonic)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleCopyNsec() {
    Clipboard.setStringAsync(keys.nsec)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleCopyNpub() {
    Clipboard.setStringAsync(keys.npub)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleNext() {
    router.navigate({
      params: {
        mnemonic,
        npub: keys.npub,
        nsec: keys.nsec
      },
      pathname: '/signer/nostr/create/profile'
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
            <SSText center size="sm" color="muted" uppercase>
              {t('nostrIdentity.create.seedWords')}
            </SSText>
            <View style={styles.keyGroup}>
              <View style={styles.wordsGrid}>
                {chunkSeedWords(words, 3).map((row, rowIndex) => (
                  <SSHStack key={rowIndex} gap="sm" style={styles.wordRow}>
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
                ))}
              </View>
              <SSHStack gap="sm" style={styles.keyActionsRow}>
                <SSButton
                  label={t('common.copy')}
                  variant="outline"
                  onPress={handleCopyMnemonic}
                  style={styles.keyActionButtonFlex}
                />
                <SSButton
                  label={t('account.seed.seedqr.title')}
                  variant="outline"
                  onPress={() => setSeedQrVisible(true)}
                  style={styles.keyActionButtonFlex}
                />
              </SSHStack>
            </View>
          </SSVStack>

          {/* nsec */}
          <SSVStack gap="sm">
            <SSText center size="sm" color="muted" uppercase>
              {t('nostrIdentity.create.nsec')}
            </SSText>
            <View style={styles.keyGroup}>
              <SSText
                center
                size="xs"
                type="mono"
                style={styles.keyText}
                numberOfLines={showNsec ? 4 : 2}
              >
                {showNsec ? keys.nsec : '••••••••••••••••••••••••••••••••'}
              </SSText>
              <SSHStack gap="sm" style={styles.keyActionsRow}>
                <SSButton
                  label={showNsec ? t('common.hide') : t('common.show')}
                  variant="outline"
                  onPress={() => setShowNsec(!showNsec)}
                  style={styles.keyActionButtonFlex}
                />
                <SSButton
                  label={t('common.copy')}
                  variant="outline"
                  onPress={handleCopyNsec}
                  style={styles.keyActionButtonFlex}
                />
                <SSButton
                  label={t('common.showQR')}
                  variant="outline"
                  onPress={() => setQrModalValue(keys.nsec)}
                  style={styles.keyActionButtonFlex}
                />
              </SSHStack>
            </View>
          </SSVStack>

          {/* npub */}
          <SSVStack gap="sm">
            <SSText center size="sm" color="muted" uppercase>
              {t('nostrIdentity.create.npub')}
            </SSText>
            <View style={styles.keyGroup}>
              <SSText
                center
                size="xs"
                type="mono"
                style={styles.keyText}
                numberOfLines={4}
              >
                {keys.npub}
              </SSText>
              <SSHStack gap="sm" style={styles.keyActionsRow}>
                <SSButton
                  label={t('common.copy')}
                  variant="outline"
                  onPress={handleCopyNpub}
                  style={styles.keyActionButtonFlex}
                />
                <SSButton
                  label={t('common.showQR')}
                  variant="outline"
                  onPress={() => setQrModalValue(keys.npub)}
                  style={styles.keyActionButtonFlex}
                />
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

      <SSSeedQR
        mnemonic={mnemonic}
        visible={seedQrVisible}
        onClose={() => setSeedQrVisible(false)}
      />

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
  keyGroup: {
    alignSelf: 'stretch',
    width: '100%'
  },
  keyText: {
    lineHeight: 18,
    marginBottom: 4
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
    gap: 8
  }
})
