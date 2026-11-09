import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Share, StyleSheet, TextInput } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSIconWarning from '@/components/icons/SSIconWarning'
import SSBackupPayloadSummary from '@/components/SSBackupPayloadSummary'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSModal from '@/components/SSModal'
import SSPinAuth from '@/components/SSPinAuth'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import {
  DEFAULT_LOCK_DELTA_TIME_SECONDS,
  DEFAULT_PIN_MAX_TRIES,
  DURESS_PIN_KEY,
  PIN_KDF_COMMIT_KEY,
  PIN_KEY,
  SALT_KEY
} from '@/config/auth'
import { APP_VERSION, BUILD_NUMBER } from '@/constants/version'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { deleteItem, getEcashMnemonic } from '@/storage/encrypted'
import { clearAllStorage } from '@/storage/mmkv'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { useDevConsoleStore } from '@/store/devConsole'
import { useEcashStore } from '@/store/ecash'
import { useLightningStore } from '@/store/lightning'
import { useNostrStore } from '@/store/nostr'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { DEFAULT_WORD_LIST } from '@/types/bips/39'
import { type Key } from '@/types/models/Account'
import { collectArkBackup } from '@/utils/arkBackup'
import { encryptBackup } from '@/utils/backupEncryption'
import { getBackupFilename } from '@/utils/backupFilename'
import {
  isValidBackupPassphrase,
  MIN_BACKUP_PASSPHRASE_LENGTH
} from '@/utils/backupPassphrase'
import { collectBlockchainBackup } from '@/utils/blockchainBackup'
import { decryptAccountKeySecretUsingPin } from '@/utils/decryption'
import {
  isDevConsoleAvailable,
  toggleDevConsoleEnabled,
  wipeDevConsoleLog
} from '@/utils/devConsole'
import { saveFile } from '@/utils/filesystem'
import { backupKeySecretFields, type BackupKeySecret } from '@/utils/keyBackup'
import { resetInstance as resetNostrSync } from '@/utils/nostrSyncService'
import { getPin } from '@/utils/pin'

const DEV_CONSOLE_AVAILABLE = isDevConsoleAvailable()

const BACKUP_PIN_MAX_TRIES = 3

type DeveloperConfirmSheet =
  | { kind: 'confirmDelete' }
  | { kind: 'confirmClear' }

type DeveloperSheet =
  | { kind: 'none' }
  | DeveloperConfirmSheet
  | { kind: 'backupPin'; returnTo: DeveloperSheet }
  | { kind: 'backupPreview'; payload: string; returnTo: DeveloperSheet }

/** The sheet to show once the backup flow started from `sheet` is done. */
function getBackupReturnSheet(sheet: DeveloperSheet): DeveloperSheet {
  if (sheet.kind === 'backupPin' || sheet.kind === 'backupPreview') {
    return sheet.returnTo
  }
  return sheet
}

export default function Developer() {
  const devConsoleEnabled = useDevConsoleStore((state) => state.enabled)
  const router = useRouter()
  const accounts = useAccountsStore((state) => state.accounts)
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
  const [skipPin, setSkipPin, enableDevSkipPin] = useAuthStore(
    useShallow((state) => [
      state.skipPin,
      state.setSkipPin,
      state.enableDevSkipPin
    ])
  )
  const [currencyUnit, useZeroPadding, mnemonicWordList] = useSettingsStore(
    useShallow((s) => [s.currencyUnit, s.useZeroPadding, s.mnemonicWordList])
  )

  // One sheet at a time: the backup flow replaces a confirm sheet and hands
  // back to it when done, instead of stacking a second native modal on top.
  const [sheet, setSheet] = useState<DeveloperSheet>({ kind: 'none' })
  const [backupPassphrase, setBackupPassphrase] = useState('')
  const [isEncryptingBackup, setIsEncryptingBackup] = useState(false)
  const backupPreviewPayload =
    sheet.kind === 'backupPreview' ? sheet.payload : null
  const backupReturnTo = getBackupReturnSheet(sheet)

  function closeBackupPreview() {
    setSheet(backupReturnTo)
    setBackupPassphrase('')
  }

  async function buildBackupWithSeeds(): Promise<string> {
    const pin = await getPin()
    const keysWithSeeds = async (accountId: string, keys: Key[]) => {
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
        let secretFields: BackupKeySecret = {}
        if (pin) {
          try {
            const secret = await decryptAccountKeySecretUsingPin(
              accountId,
              key.index,
              pin
            )
            secretFields = backupKeySecretFields(secret)
          } catch {
            // leave the key without secret fields
          }
        }
        result.push({ ...base, ...secretFields })
      }
      return result
    }

    const accountsWithSeeds = await Promise.all(
      accounts.map(async (account) => ({
        birthdayDate: account.birthdayDate,
        excludedUtxoOutpoints: account.excludedUtxoOutpoints ?? [],
        id: account.id,
        keys: await keysWithSeeds(account.id, account.keys),
        labels: account.labels,
        name: account.name,
        network: account.network,
        nostr: account.nostr,
        policyType: account.policyType,
        rpcLastBlockHash: account.rpcLastBlockHash,
        summary: account.summary
      }))
    )

    const nostrState = useNostrStore.getState()
    const ecashState = useEcashStore.getState()
    const ecashMnemonics = Object.fromEntries(
      await Promise.all(
        ecashState.accounts.map(async (account) => [
          account.id,
          await getEcashMnemonic(account.id)
        ])
      )
    )
    const arkState = await collectArkBackup()
    const lightningState = useLightningStore.getState()
    const nostrIdentityState = useNostrIdentityStore.getState()
    const blockchainState = useBlockchainStore.getState()

    const backupData = {
      accounts: accountsWithSeeds,
      appVersion: APP_VERSION,
      ark: arkState,
      buildNumber: BUILD_NUMBER,
      ecash: {
        accounts: ecashState.accounts,
        activeAccountId: ecashState.activeAccountId,
        counters: ecashState.counters,
        mints: ecashState.mints,
        mnemonics: ecashMnemonics,
        proofs: ecashState.proofs,
        quotes: ecashState.quotes,
        transactions: ecashState.transactions
      },
      exportedAt: new Date().toISOString(),
      lightning: {
        channels: lightningState.status.channels ?? [],
        config: lightningState.config,
        isConnected: lightningState.status.isConnected,
        lastSync: lightningState.status.lastSync ?? null,
        nodeInfo: lightningState.status.nodeInfo ?? null
      },
      lnd: lightningState.config,
      nostr: {
        members: nostrState.members,
        profiles: nostrState.profiles,
        trustedDevices: nostrState.trustedDevices
      },
      nostrIdentities: {
        activeIdentityNpub: nostrIdentityState.activeIdentityNpub,
        identities: nostrIdentityState.identities,
        relays: nostrIdentityState.relays
      },
      serverSettings: await collectBlockchainBackup(blockchainState),
      settings: { currencyUnit, mnemonicWordList, useZeroPadding },
      version: 1
    }

    return JSON.stringify(backupData)
  }

  async function openBackupPreview(returnTo: DeveloperSheet) {
    try {
      const payload = await buildBackupWithSeeds()
      setSheet({ kind: 'backupPreview', payload, returnTo })
    } catch {
      setSheet(returnTo)
      toast.error(t('settings.developer.backupError'))
    }
  }

  // The backup decrypts every seed, so it asks for the PIN like seed export.
  // The dev-only skip-PIN mode has no PIN the user knows.
  async function handleBackupData() {
    if (skipPin) {
      await openBackupPreview(backupReturnTo)
      return
    }
    setSheet({ kind: 'backupPin', returnTo: backupReturnTo })
  }

  async function handleBackupPinSuccess() {
    await openBackupPreview(backupReturnTo)
  }

  function showBackupPassphraseError() {
    toast.error(
      t('settings.developer.backupPassphraseRequirements', {
        min: MIN_BACKUP_PASSPHRASE_LENGTH
      })
    )
  }

  async function encryptBackupPreview(payload: string) {
    setIsEncryptingBackup(true)
    try {
      return await encryptBackup(payload, backupPassphrase)
    } finally {
      setIsEncryptingBackup(false)
    }
  }

  async function handleEncryptAndShare() {
    if (!backupPreviewPayload) {
      return
    }
    if (!isValidBackupPassphrase(backupPassphrase)) {
      showBackupPassphraseError()
      return
    }
    try {
      const encryptedPayload = await encryptBackupPreview(backupPreviewPayload)
      const result = await Share.share({
        message: encryptedPayload,
        title: getBackupFilename(APP_VERSION)
      })
      if (result.action === Share.sharedAction) {
        toast.success(t('settings.developer.backupSuccess'))
        closeBackupPreview()
      }
    } catch {
      toast.error(t('settings.developer.backupError'))
    }
  }

  async function handleEncryptAndSaveFile() {
    if (!backupPreviewPayload) {
      return
    }
    if (!isValidBackupPassphrase(backupPassphrase)) {
      showBackupPassphraseError()
      return
    }
    const filename = getBackupFilename(APP_VERSION)
    try {
      const encryptedPayload = await encryptBackupPreview(backupPreviewPayload)
      const didSave = await saveFile({
        dialogTitle: t('settings.developer.backupData'),
        fileContent: encryptedPayload,
        filename,
        mimeType: 'application/json'
      })
      if (!didSave) {
        return
      }
      toast.success(t('settings.developer.backupSuccess'))
      closeBackupPreview()
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined
      toast.error(
        message
          ? `${t('settings.developer.backupError')}: ${message}`
          : t('settings.developer.backupError')
      )
    }
  }

  async function handleDeleteAccounts() {
    await resetNostrSync()
    useNostrStore.getState().clearAllNostrState()
    await deleteAccounts()
    deleteWallets()
    setSheet({ kind: 'none' })
    toast.error(t('settings.developer.accountsDeleted'))
  }

  async function handleClearStorage() {
    try {
      clearAllStorage()
      wipeDevConsoleLog()
      await Promise.all([
        deleteItem(PIN_KEY),
        deleteItem(PIN_KDF_COMMIT_KEY),
        deleteItem(SALT_KEY),
        deleteItem(DURESS_PIN_KEY)
      ])
      await resetNostrSync()
      await deleteAccounts()
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
      setSheet({ kind: 'none' })
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
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.title')}</SSText>
          )
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
              onPress={() => router.navigate('/settings/developerRecover')}
              variant="secondary"
            />
          </SSVStack>
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSButton
              label={t('settings.developer.deleteAccounts')}
              onPress={() => setSheet({ kind: 'confirmDelete' })}
            />
            <SSButton
              label={t('settings.developer.clearStorage')}
              onPress={() => setSheet({ kind: 'confirmClear' })}
            />
          </SSVStack>
          {DEV_CONSOLE_AVAILABLE ? (
            <>
              <SSSeparator color="gradient" />
              <SSVStack gap="xs">
                <SSCheckbox
                  label={t('settings.developer.devConsole')}
                  selected={devConsoleEnabled}
                  onPress={toggleDevConsoleEnabled}
                />
                <SSText color="muted" size="sm">
                  {t('settings.developer.devConsoleDescription')}
                </SSText>
              </SSVStack>
            </>
          ) : null}
          {__DEV__ ? (
            <>
              <SSSeparator color="gradient" />
              <SSVStack>
                <SSCheckbox
                  label={t('settings.developer.skipPin')}
                  selected={skipPin}
                  onPress={() => {
                    if (skipPin) {
                      setSkipPin(false)
                      return
                    }
                    void enableDevSkipPin()
                  }}
                />
              </SSVStack>
            </>
          ) : null}
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSButton
              label={t('settings.developer.diagnosis.title')}
              onPress={() => router.navigate('/settings/developerDiagnosis')}
              variant="outline"
            />
            {DEV_CONSOLE_AVAILABLE ? (
              <SSButton
                label={t('settings.developer.design')}
                onPress={() => router.navigate('/settings/design')}
                variant="outline"
              />
            ) : null}
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
      <SSModal
        visible={sheet.kind === 'confirmDelete'}
        onClose={() => setSheet({ kind: 'none' })}
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
        visible={sheet.kind === 'confirmClear'}
        onClose={() => setSheet({ kind: 'none' })}
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
        visible={sheet.kind === 'backupPin'}
        fullOpacity
        onClose={() => setSheet(backupReturnTo)}
      >
        <SSPinAuth
          title={t('account.enter.pin')}
          onSuccess={handleBackupPinSuccess}
          onTriesOver={() => setSheet(backupReturnTo)}
          maxTries={BACKUP_PIN_MAX_TRIES}
        />
      </SSModal>
      <SSModal
        visible={sheet.kind === 'backupPreview'}
        onClose={closeBackupPreview}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSScrollView
          style={styles.backupPreviewScroll}
          contentContainerStyle={styles.backupPreviewScrollContent}
        >
          <SSVStack gap="md" widthFull>
            <SSText center size="lg" uppercase>
              {t('settings.developer.backupModalTitle')}
            </SSText>
            <SSText center color="muted" size="sm">
              {t('settings.developer.backupPreviewWarning')}
            </SSText>
            {backupPreviewPayload ? (
              <SSBackupPayloadSummary payload={backupPreviewPayload} />
            ) : null}
            <SSVStack gap="xs" widthFull>
              <SSText color="muted" size="sm">
                {t('settings.developer.backupPassphraseLabel')}
              </SSText>
              <TextInput
                placeholder={t(
                  'settings.developer.backupPassphrasePlaceholder'
                )}
                placeholderTextColor={Colors.gray[400]}
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
            <SSVStack gap="sm" widthFull>
              <SSButton
                label={t('settings.developer.backupEncryptShare')}
                onPress={handleEncryptAndShare}
                loading={isEncryptingBackup}
                variant="default"
              />
              <SSButton
                label={t('settings.developer.backupEncryptSaveFile')}
                onPress={handleEncryptAndSaveFile}
                loading={isEncryptingBackup}
                variant="secondary"
              />
            </SSVStack>
          </SSVStack>
        </SSScrollView>
      </SSModal>
    </>
  )
}

const styles = StyleSheet.create({
  backupPreviewScroll: {
    alignSelf: 'stretch',
    flex: 1,
    width: '100%'
  },
  backupPreviewScrollContent: {
    flexGrow: 1,
    paddingVertical: 8
  },
  passphraseInput: {
    alignSelf: 'stretch',
    borderColor: Colors.gray[500],
    borderRadius: 4,
    borderWidth: 1,
    color: Colors.gray['200'],
    padding: 12,
    width: '100%'
  }
})
