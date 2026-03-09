import { Stack } from 'expo-router'
import { useState } from 'react'
import { Share } from 'react-native'
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
import { DEFAULT_WORD_LIST } from '@/utils/bip39'
import { resetInstance as resetNostrSync } from '@/utils/nostrSyncService'

export default function Developer() {
  const accounts = useAccountsStore((state) => state.accounts)
  const deleteAccounts = useAccountsStore((state) => state.deleteAccounts)
  const deleteWallets = useWalletsStore((state) => state.deleteWallets)
  const [skipPin, setSkipPin] = useAuthStore(
    useShallow((state) => [state.skipPin, state.setSkipPin])
  )
  const [currencyUnit, useZeroPadding, mnemonicWordList] = useSettingsStore(
    useShallow((s) => [s.currencyUnit, s.useZeroPadding, s.mnemonicWordList])
  )

  const [deleteAccountsModalVisible, setDeleteAccountsModalVisible] =
    useState(false)
  const [clearStorageModalVisible, setClearStorageModalVisible] =
    useState(false)

  async function handleBackupData() {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        accounts: accounts.map((account) => ({
          id: account.id,
          name: account.name,
          network: account.network,
          policyType: account.policyType,
          keys: account.keys,
          summary: account.summary,
          nostr: account.nostr
        })),
        settings: { currencyUnit, useZeroPadding, mnemonicWordList }
      }

      const payload = JSON.stringify(backupData, null, 2)

      const result = await Share.share({
        message: payload,
        title: t('settings.developer.backupData')
      })

      if (result.action === Share.sharedAction) {
        toast.success(t('settings.developer.backupSuccess'))
      }
    } catch (_error) {
      toast.error(t('settings.developer.backupError'))
    }
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
    </>
  )
}
