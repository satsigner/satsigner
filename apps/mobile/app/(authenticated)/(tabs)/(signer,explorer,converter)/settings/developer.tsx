import * as Clipboard from 'expo-clipboard'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Share, StyleSheet, TextInput } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSModal from '@/components/SSModal'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES,
  DURESS_PIN_KEY,
  PIN_KEY,
  SALT_KEY
} from '@/config/auth'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { deleteItem } from '@/storage/encrypted'
import { clearAllStorage } from '@/storage/mmkv'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useNostrStore } from '@/store/nostr'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type Key } from '@/types/models/Account'
import { DEFAULT_WORD_LIST } from '@/utils/bip39'
import {
  aesDecrypt,
  aesEncrypt,
  generateSalt,
  getPinForDecryption,
  pbkdf2Encrypt,
  randomIv
} from '@/utils/crypto'
import { resetInstance as resetNostrSync } from '@/utils/nostrSyncService'
import { performRecoverOverwrite } from '@/utils/recoverBackup'

export default function Developer() {
  const accounts = useAccountsStore((state) => state.accounts)
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
  const [
    skipPin,
    setSkipPin,
    setLockTriggered,
    setPendingRecoverData,
    setRequiresAuth
  ] = useAuthStore(
    useShallow((state) => [
      state.skipPin,
      state.setSkipPin,
      state.setLockTriggered,
      state.setPendingRecoverData,
      state.setRequiresAuth
    ])
  )
  const [currencyUnit, useZeroPadding, mnemonicWordList] = useSettingsStore(
    useShallow((s) => [s.currencyUnit, s.useZeroPadding, s.mnemonicWordList])
  )

  const [deleteAccountsModalVisible, setDeleteAccountsModalVisible] =
    useState(false)
  const [clearStorageModalVisible, setClearStorageModalVisible] =
    useState(false)
  const [backupPreviewVisible, setBackupPreviewVisible] = useState(false)
  const [backupPreviewPayload, setBackupPreviewPayload] = useState<
    string | null
  >(null)
  const [backupPassphrase, setBackupPassphrase] = useState('')
  const [recoverModalVisible, setRecoverModalVisible] = useState(false)
  const [recoverEncryptedInput, setRecoverEncryptedInput] = useState('')
  const [recoverPassphrase, setRecoverPassphrase] = useState('')
  const [recoverDecrypted, setRecoverDecrypted] = useState<string | null>(null)
  const [recoverConfirmOverwrite, setRecoverConfirmOverwrite] = useState(false)

  async function buildBackupWithSeeds(): Promise<string> {
    const pin = await getPinForDecryption(skipPin)
    const keysWithSeeds = async (keys: Key[]) => {
      const result = []
      for (const key of keys) {
        const base = {
          creationType: key.creationType,
          derivationPath: key.derivationPath,
          fingerprint: key.fingerprint,
          index: key.index,
          mnemonicWordCount: key.mnemonicWordCount,
          mnemonicWordList: key.mnemonicWordList,
          name: key.name,
          scriptVersion: key.scriptVersion
        }
        let seedWords: string | undefined
        let passphrase: string | undefined
        if (typeof key.secret === 'string' && key.iv && pin) {
          try {
            const decrypted = await aesDecrypt(key.secret, pin, key.iv)
            const secret = JSON.parse(decrypted) as {
              mnemonic?: string
              passphrase?: string
            }
            seedWords = secret.mnemonic
            passphrase = secret.passphrase
          } catch {
            // leave seedWords/passphrase undefined
          }
        }
        result.push({
          ...base,
          ...(passphrase !== undefined && { passphrase }),
          ...(seedWords !== undefined && { seedWords })
        })
      }
      return result
    }

    const accountsWithSeeds = await Promise.all(
      accounts.map(async (account) => ({
        id: account.id,
        keys: await keysWithSeeds(account.keys),
        name: account.name,
        network: account.network,
        nostr: account.nostr,
        policyType: account.policyType,
        summary: account.summary
      }))
    )

    const backupData = {
      accounts: accountsWithSeeds,
      exportedAt: new Date().toISOString(),
      settings: { currencyUnit, mnemonicWordList, useZeroPadding },
      version: 1
    }

    return JSON.stringify(backupData, null, 2)
  }

  async function handleBackupData() {
    try {
      const payload = await buildBackupWithSeeds()
      setBackupPreviewPayload(payload)
      setBackupPreviewVisible(true)
    } catch (_error) {
      toast.error(t('settings.developer.backupError'))
    }
  }

  /** Printable ASCII (space through tilde): letters, digits, space, symbols */
  const PASSPHRASE_ALLOWED_REGEX = /^[\x20-\x7E]+$/

  async function handleEncryptAndShare() {
    if (!backupPreviewPayload) return
    if (
      backupPassphrase.length === 0 ||
      !PASSPHRASE_ALLOWED_REGEX.test(backupPassphrase)
    ) {
      toast.error(t('settings.developer.backupPassphraseInvalid'))
      return
    }
    try {
      const salt = await generateSalt()
      const key = await pbkdf2Encrypt(backupPassphrase, salt)
      const iv = randomIv()
      const cipher = await aesEncrypt(backupPreviewPayload, key, iv)
      const encryptedPayload = JSON.stringify({
        cipher,
        iv,
        salt,
        v: 1
      })
      const result = await Share.share({
        message: encryptedPayload,
        title: t('settings.developer.backupData')
      })
      if (result.action === Share.sharedAction) {
        toast.success(t('settings.developer.backupSuccess'))
        setBackupPreviewVisible(false)
        setBackupPreviewPayload(null)
        setBackupPassphrase('')
      }
    } catch (_error) {
      toast.error(t('settings.developer.backupError'))
    }
  }

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
        throw new Error('Invalid payload shape')
      }
      const key = await pbkdf2Encrypt(recoverPassphrase, payload.salt)
      const plain = await aesDecrypt(payload.cipher, key, payload.iv)
      setRecoverDecrypted(plain)
    } catch (_err) {
      toast.error(t('settings.developer.recoverDecryptError'))
    }
  }

  async function handleRecoverImSure() {
    if (!recoverDecrypted) return
    if (skipPin) {
      const { success } = await performRecoverOverwrite(recoverDecrypted)
      setRecoverModalVisible(false)
      setRecoverEncryptedInput('')
      setRecoverPassphrase('')
      setRecoverDecrypted(null)
      setRecoverConfirmOverwrite(false)
      if (success) toast.success(t('settings.developer.backupSuccess'))
      else toast.error(t('settings.developer.recoverOverwriteError'))
      return
    }
    setPendingRecoverData(recoverDecrypted)
    setRecoverModalVisible(false)
    setRecoverEncryptedInput('')
    setRecoverPassphrase('')
    setRecoverDecrypted(null)
    setRecoverConfirmOverwrite(false)
    setRequiresAuth(true)
    setLockTriggered(true)
  }

  function handleDeleteAccounts() {
    resetNostrSync()
    useNostrStore.getState().clearAllNostrState()
    deleteAccounts()
    deleteWallets()
    setDeleteAccountsModalVisible(false)
    toast.error(t('settings.developer.accountsDeleted'))
  }

  async function handleClearStorage() {
    try {
      clearAllStorage()
      await Promise.all([
        deleteItem(PIN_KEY),
        deleteItem(SALT_KEY),
        deleteItem(DURESS_PIN_KEY)
      ])
      resetNostrSync()
      deleteAccounts()
      deleteWallets()
      useAuthStore.setState({
        duressPinEnabled: false,
        firstTime: true,
        justUnlocked: false,
        lockDeltaTime: DEFAULT_LOCK_DELTA_TIME_SECONDS,
        lockTriggered: false,
        pageHistory: [],
        pinMaxTries: DEFAULT_PIN_MAX_TRIES,
        pinTries: 0,
        requiresAuth: false,
        skipPin: false
      })
      useSettingsStore.setState({
        currencyUnit: 'sats',
        mnemonicWordList: DEFAULT_WORD_LIST,
        showWarning: true,
        skipSeedConfirmation: true,
        useZeroPadding: false
      })
      setClearStorageModalVisible(false)
      toast.success(t('settings.developer.storageCleared'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`${t('settings.developer.storageClearFailed')}: ${message}`)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack gap="lg">
          <SSVStack>
            <SSButton
              label={t('settings.developer.backupData')}
              onPress={handleBackupData}
              variant="secondary"
            />
            <SSButton
              label={t('settings.developer.recoverData')}
              onPress={() => {
                setRecoverEncryptedInput('')
                setRecoverPassphrase('')
                setRecoverDecrypted(null)
                setRecoverConfirmOverwrite(false)
                setRecoverModalVisible(true)
              }}
              variant="secondary"
            />
          </SSVStack>
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSButton
              label={t('settings.developer.deleteAccounts')}
              onPress={() => setDeleteAccountsModalVisible(true)}
            />
            <SSButton
              label={t('settings.developer.clearStorage')}
              onPress={() => setClearStorageModalVisible(true)}
            />
          </SSVStack>
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSCheckbox
              label={t('settings.developer.skipPin')}
              selected={skipPin}
              onPress={() => setSkipPin(!skipPin)}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
      <SSModal
        visible={deleteAccountsModalVisible}
        onClose={() => setDeleteAccountsModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={{ paddingVertical: 8 }}>
          <SSVStack gap="xs" style={{ alignItems: 'center' }}>
            <SSIconWarning
              height={20}
              width={20}
              fill="transparent"
              stroke={Colors.gray[400]}
            />
            <SSText center color="muted">
              {t('settings.developer.deleteAccountsWarning')}
            </SSText>
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              label={t('settings.developer.backupData')}
              onPress={handleBackupData}
              variant="secondary"
            />
            <SSButton
              label={t('settings.developer.deleteAccountsConfirm')}
              onPress={handleDeleteAccounts}
              variant="danger"
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
      <SSModal
        visible={clearStorageModalVisible}
        onClose={() => setClearStorageModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={{ paddingVertical: 8 }}>
          <SSVStack gap="xs" style={{ alignItems: 'center' }}>
            <SSIconWarning
              height={20}
              width={20}
              fill="transparent"
              stroke={Colors.gray[400]}
            />
            <SSText center color="muted">
              {t('settings.developer.clearStorageWarning')}
            </SSText>
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              label={t('settings.developer.backupData')}
              onPress={handleBackupData}
              variant="secondary"
            />
            <SSButton
              label={t('settings.developer.clearStorageConfirm')}
              onPress={handleClearStorage}
              variant="danger"
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
      <SSModal
        visible={backupPreviewVisible}
        onClose={() => {
          setBackupPreviewVisible(false)
          setBackupPreviewPayload(null)
          setBackupPassphrase('')
        }}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.backupPreviewModal}>
          <SSText center size="lg" uppercase>
            {t('settings.developer.backupModalTitle')}
          </SSText>
          <SSText center color="muted" size="sm">
            {t('settings.developer.backupPreviewWarning')}
          </SSText>
          <ScrollView
            style={styles.modalTextAreaScroll}
            contentContainerStyle={styles.modalTextAreaScrollContent}
          >
            <TextInput
              editable={false}
              multiline
              style={styles.backupPreviewText}
              value={backupPreviewPayload ?? ''}
            />
          </ScrollView>
          <SSVStack gap="xs">
            <SSText color="muted" size="sm">
              {t('settings.developer.backupPassphraseLabel')}
            </SSText>
            <TextInput
              placeholder={t('settings.developer.backupPassphrasePlaceholder')}
              secureTextEntry
              style={styles.passphraseInput}
              value={backupPassphrase}
              onChangeText={setBackupPassphrase}
            />
            <SSText color="muted" size="xs">
              {t('settings.developer.backupPassphraseAllowed')}
            </SSText>
          </SSVStack>
          <SSText color="muted" size="xs">
            {t('settings.developer.backupEncryptionNote')}
          </SSText>
          <SSVStack gap="sm">
            <SSButton
              label={t('settings.developer.backupEncryptShare')}
              onPress={handleEncryptAndShare}
              variant="default"
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
      <SSModal
        visible={recoverModalVisible}
        onClose={() => {
          setRecoverModalVisible(false)
          setRecoverEncryptedInput('')
          setRecoverPassphrase('')
          setRecoverDecrypted(null)
          setRecoverConfirmOverwrite(false)
        }}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.recoverModal}>
          <SSText center size="lg" uppercase>
            {t('settings.developer.recoverTitle')}
          </SSText>
          {recoverDecrypted === null ? (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="sm">
                  {t('settings.developer.recoverEncryptedLabel')}
                </SSText>
                <ScrollView
                  style={styles.modalTextAreaScroll}
                  contentContainerStyle={styles.modalTextAreaScrollContent}
                >
                  <TextInput
                    placeholder={t(
                      'settings.developer.recoverEncryptedPlaceholder'
                    )}
                    style={styles.backupPreviewText}
                    multiline
                    value={recoverEncryptedInput}
                    onChangeText={setRecoverEncryptedInput}
                  />
                </ScrollView>
                <SSButton
                  label={t('common.paste')}
                  onPress={handleRecoverPaste}
                  variant="secondary"
                />
              </SSVStack>
              <SSVStack gap="xs">
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
              <SSButton
                label={t('settings.developer.recoverDecrypt')}
                onPress={handleRecoverDecrypt}
                variant="secondary"
              />
            </>
          ) : (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="sm">
                  {t('settings.developer.recoverDecryptedLabel')}
                </SSText>
                <ScrollView
                  style={styles.modalTextAreaScroll}
                  contentContainerStyle={styles.modalTextAreaScrollContent}
                >
                  <TextInput
                    editable={false}
                    multiline
                    style={styles.backupPreviewText}
                    value={recoverDecrypted}
                  />
                </ScrollView>
              </SSVStack>
              <SSButton
                label={t('settings.developer.recoverOverwrite')}
                onPress={() => setRecoverConfirmOverwrite(true)}
                variant="secondary"
              />
              {recoverConfirmOverwrite && (
                <SSButton
                  label={t('settings.developer.recoverImSure')}
                  onPress={handleRecoverImSure}
                  variant="danger"
                />
              )}
            </>
          )}
        </SSVStack>
      </SSModal>
    </>
  )
}

const styles = StyleSheet.create({
  backupPreviewModal: {
    maxHeight: '80%',
    paddingVertical: 8
  },
  recoverModal: {
    maxHeight: '85%',
    paddingVertical: 8
  },
  modalTextAreaScroll: {
    borderColor: Colors.gray[500],
    borderRadius: 4,
    borderWidth: 1,
    maxHeight: 320
  },
  modalTextAreaScrollContent: {
    paddingBottom: 16
  },
  passphraseInput: {
    borderColor: Colors.gray[500],
    borderRadius: 4,
    borderWidth: 1,
    color: Colors.gray['200'],
    padding: 12
  },
  backupPreviewText: {
    color: Colors.gray['200'],
    fontFamily: 'monospace',
    fontSize: 11,
    padding: 8
  }
})
