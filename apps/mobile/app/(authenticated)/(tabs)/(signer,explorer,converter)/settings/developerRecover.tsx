import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TextInput } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAuthStore } from '@/store/auth'
import { Colors } from '@/styles'
import { aesDecrypt, pbkdf2Encrypt } from '@/utils/crypto'
import { type DetectedContent } from '@/utils/contentDetector'
import { pickFile } from '@/utils/filesystem'
import { performRecoverOverwrite } from '@/utils/recoverBackup'

const ENCRYPTED_BACKUP_MAX_HEIGHT = 240

export default function DeveloperRecover() {
  const router = useRouter()
  const [
    skipPin,
    setLockTriggered,
    setPendingRecoverData,
    setRequiresAuth
  ] = useAuthStore(
    useShallow((state) => [
      state.skipPin,
      state.setLockTriggered,
      state.setPendingRecoverData,
      state.setRequiresAuth
    ])
  )

  const [recoverEncryptedInput, setRecoverEncryptedInput] = useState('')
  const [recoverPassphrase, setRecoverPassphrase] = useState('')
  const [recoverDecrypted, setRecoverDecrypted] = useState<string | null>(null)
  const [recoverConfirmOverwrite, setRecoverConfirmOverwrite] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  async function handleRecoverPaste() {
    try {
      const text = await Clipboard.getStringAsync()
      if (text) {
        setRecoverEncryptedInput(text)
        toast.success(t('common.success.dataPasted'))
      } else {
        toast.error(t('common.error.noClipboardData'))
      }
    } catch {
      toast.error(t('common.error.pasteFromClipboard'))
    }
  }

  function handleRecoverQrScanned(content: DetectedContent) {
    if (content.type !== 'encrypted_backup') {
      return
    }
    setRecoverEncryptedInput(content.cleaned)
    setCameraModalVisible(false)
    toast.success(t('common.success.qrScanned'))
  }

  async function handleRecoverUploadFile() {
    try {
      const text = await pickFile({ type: 'application/json' })
      if (!text) {
        return
      }
      setRecoverEncryptedInput(text)
      toast.success(t('common.success.dataPasted'))
    } catch {
      toast.error(t('settings.developer.recoverUploadError'))
    }
  }

  async function handleRecoverDecrypt() {
    const raw = recoverEncryptedInput.trim()
    if (!raw || !recoverPassphrase.trim()) {
      toast.error(t('settings.developer.backupPassphraseInvalid'))
      return
    }
    try {
      const payload = JSON.parse(raw) as {
        cipher: string
        iv: string
        salt: string
        v: number
      }
      if (
        typeof payload.cipher !== 'string' ||
        typeof payload.iv !== 'string' ||
        typeof payload.salt !== 'string'
      ) {
        throw new TypeError('Invalid payload shape')
      }
      const key = await pbkdf2Encrypt(recoverPassphrase, payload.salt)
      const plain = await aesDecrypt(payload.cipher, key, payload.iv)
      setRecoverDecrypted(plain)
    } catch {
      toast.error(t('settings.developer.recoverDecryptError'))
    }
  }

  async function handleRecoverImSure() {
    if (!recoverDecrypted) {
      return
    }
    if (skipPin) {
      const { success } = await performRecoverOverwrite(recoverDecrypted)
      if (success) {
        toast.success(t('settings.developer.backupSuccess'))
      } else {
        toast.error(t('settings.developer.recoverOverwriteError'))
      }
      router.back()
      return
    }
    setPendingRecoverData(recoverDecrypted)
    setRequiresAuth(true)
    setLockTriggered(true)
    router.back()
  }

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.recoverTitle')}</SSText>
          )
        }}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SSVStack gap="lg" style={styles.scrollContent}>
          {recoverDecrypted === null ? (
            <>
              <SSVStack gap="xs" widthFull>
                <SSText color="muted" size="sm">
                  {t('settings.developer.recoverEncryptedLabel')}
                </SSText>
                <TextInput
                  multiline
                  placeholder={t(
                    'settings.developer.recoverEncryptedPlaceholder'
                  )}
                  scrollEnabled
                  style={styles.encryptedInput}
                  value={recoverEncryptedInput}
                  onChangeText={setRecoverEncryptedInput}
                />
                <SSHStack gap="xs" style={styles.actionRow}>
                  <SSButton
                    label={t('common.paste')}
                    onPress={handleRecoverPaste}
                    style={styles.actionRowButton}
                  />
                  <SSButton
                    label={t('settings.developer.recoverUploadFile')}
                    onPress={handleRecoverUploadFile}
                    style={styles.actionRowButton}
                  />
                  <SSButton
                    label={t('settings.developer.recoverScanQr')}
                    onPress={() => setCameraModalVisible(true)}
                    style={styles.actionRowButton}
                  />
                </SSHStack>
              </SSVStack>
              <SSVStack gap="xs" widthFull>
                <SSText color="muted" size="sm">
                  {t('settings.developer.backupPassphraseLabel')}
                </SSText>
                <TextInput
                  placeholder={t(
                    'settings.developer.recoverPassphrasePlaceholder'
                  )}
                  secureTextEntry
                  style={styles.passphraseInput}
                  value={recoverPassphrase}
                  onChangeText={setRecoverPassphrase}
                />
              </SSVStack>
              <SSVStack widthFull>
                <SSButton
                  label={t('settings.developer.recoverDecrypt')}
                  onPress={handleRecoverDecrypt}
                  variant="secondary"
                />
              </SSVStack>
            </>
          ) : (
            <>
              <SSVStack gap="xs" widthFull>
                <SSText color="muted" size="sm">
                  {t('settings.developer.recoverDecryptedLabel')}
                </SSText>
                <ScrollView
                  nestedScrollEnabled
                  style={styles.decryptedScroll}
                  contentContainerStyle={styles.decryptedScrollContent}
                >
                  <TextInput
                    editable={false}
                    multiline
                    scrollEnabled={false}
                    style={styles.decryptedText}
                    value={recoverDecrypted}
                  />
                </ScrollView>
              </SSVStack>
              <SSVStack widthFull>
                <SSButton
                  label={t('settings.developer.recoverOverwrite')}
                  onPress={() => setRecoverConfirmOverwrite(true)}
                  variant="secondary"
                />
              </SSVStack>
              {recoverConfirmOverwrite && (
                <SSVStack widthFull>
                  <SSButton
                    label={t('settings.developer.recoverImSure')}
                    onPress={handleRecoverImSure}
                    variant="danger"
                  />
                </SSVStack>
              )}
            </>
          )}
        </SSVStack>
      </ScrollView>

      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onContentScanned={handleRecoverQrScanned}
        context="developer_recover"
        title={t('settings.developer.recoverScanModalTitle')}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionRow: {
    alignSelf: 'stretch',
    width: '100%'
  },
  actionRowButton: {
    flex: 1,
    minWidth: 0
  },
  decryptedScroll: {
    alignSelf: 'stretch',
    borderColor: Colors.gray[500],
    borderRadius: 3,
    borderWidth: 1,
    maxHeight: 320,
    width: '100%'
  },
  decryptedScrollContent: {
    paddingBottom: 16
  },
  decryptedText: {
    color: Colors.gray['200'],
    fontFamily: 'monospace',
    fontSize: 11,
    padding: 8
  },
  encryptedInput: {
    alignSelf: 'stretch',
    borderColor: Colors.gray[500],
    borderRadius: 3,
    borderWidth: 1,
    color: Colors.gray['200'],
    fontFamily: 'monospace',
    fontSize: 11,
    maxHeight: ENCRYPTED_BACKUP_MAX_HEIGHT,
    minHeight: 120,
    padding: 8,
    textAlignVertical: 'top',
    width: '100%'
  },
  passphraseInput: {
    alignSelf: 'stretch',
    borderColor: Colors.gray[500],
    borderRadius: 4,
    borderWidth: 1,
    color: Colors.gray['200'],
    padding: 12,
    width: '100%'
  },
  scrollContent: {
    marginTop: 24,
    paddingBottom: 32
  }
})
