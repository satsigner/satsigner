import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSEllipsisAnimation from '@/components/SSEllipsisAnimation'
import SSGradientModal from '@/components/SSGradientModal'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type ImportMnemonicSearchParams } from '@/types/navigation/searchParams'
import { getExtendedPublicKeyFromMnemonic } from '@/utils/bip39'
import { getScriptVersionDisplayName } from '@/utils/scripts'
export default function ImportMnemonic() {
  const { keyIndex } = useLocalSearchParams<ImportMnemonicSearchParams>()
  const router = useRouter()
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const {
    name,
    keys,
    scriptVersion,
    mnemonicWordCount,
    fingerprint,
    policyType,
    clearAccount,
    setMnemonic,
    passphrase,
    setPassphrase: _setPassphrase,
    setFingerprint,
    setExtendedPublicKey,
    getAccountData,
    updateKeySecret: _updateKeySecret,
    clearKeyState
  } = useAccountBuilderStore(
    useShallow((state) => ({
      name: state.name,
      keys: state.keys,
      scriptVersion: state.scriptVersion,
      mnemonicWordCount: state.mnemonicWordCount,
      fingerprint: state.fingerprint,
      policyType: state.policyType,
      clearAccount: state.clearAccount,
      setMnemonic: state.setMnemonic,
      passphrase: state.passphrase,
      setPassphrase: state.setPassphrase,
      setFingerprint: state.setFingerprint,
      setExtendedPublicKey: state.setExtendedPublicKey,
      getAccountData: state.getAccountData,
      updateKeySecret: state.updateKeySecret,
      clearKeyState: state.clearKeyState
    }))
  )
  const [network, connectionMode] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs[state.selectedNetwork].config.connectionMode
    ])
  )
  const { accountBuilderFinish } = useAccountBuilderFinish()
  const { syncAccountWithWallet } = useSyncAccountWithWallet()

  const [loadingAccount, setLoadingAccount] = useState(false)
  const [accountImported, setAccountImported] = useState(false)
  const [syncedAccount, setSyncedAccount] = useState<Account>()
  const [walletSyncFailed, setWalletSyncFailed] = useState(false)
  const [currentMnemonic, setCurrentMnemonic] = useState('')
  const [currentFingerprint, setCurrentFingerprint] = useState('')

  const [accountAddedModalVisible, setAccountAddedModalVisible] =
    useState(false)

  // Handle mnemonic validation from the component
  const handleMnemonicValid = (mnemonic: string, fingerprint: string) => {
    setCurrentMnemonic(mnemonic)
    setCurrentFingerprint(fingerprint)
    setMnemonic(mnemonic)
    setFingerprint(fingerprint)
  }

  const handleMnemonicInvalid = () => {
    setCurrentMnemonic('')
    setCurrentFingerprint('')
  }

  // Handle seed import for singlesig (full account creation)
  async function handleOnPressImportSeed() {
    setLoadingAccount(true)

    // Use the current mnemonic and fingerprint from the component
    setMnemonic(currentMnemonic)
    setFingerprint(currentFingerprint)

    // Set the key with the current data
    try {
    } catch (error) {
      setLoadingAccount(false)
      toast.error(`Failed to set key: ${(error as Error).message}`)
      return
    }

    const account = getAccountData()
    const data = await accountBuilderFinish(account)
    if (!data || !data.wallet) {
      setLoadingAccount(false)
      toast.error('Failed to create account')
      return
    }

    setAccountAddedModalVisible(true)

    try {
      if (connectionMode === 'auto') {
        const updatedAccount = await syncAccountWithWallet(
          data.accountWithEncryptedSecret,
          data.wallet
        )
        updateAccount(updatedAccount)
        setSyncedAccount(updatedAccount)
      }
      setLoadingAccount(false)
      setAccountImported(true)
    } catch (error) {
      setWalletSyncFailed(true)
      setLoadingAccount(false)
      setAccountImported(true)
      toast.error((error as Error).message)
    }
  }

  // Handle seed import for multisig (just create the key)
  async function handleOnPressImportSeedMultisig() {
    setLoadingAccount(true)

    try {
      // Use the current mnemonic and fingerprint from the component
      setMnemonic(currentMnemonic)
      setFingerprint(currentFingerprint)

      // For multisig, we need to generate the extended public key from the mnemonic
      if (currentMnemonic && currentFingerprint) {
        // Generate the extended public key
        const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
          currentMnemonic,
          passphrase || '',
          network as Network,
          scriptVersion
        )

        // Set the extended public key
        setExtendedPublicKey(extendedPublicKey)
      }

      // Set the key with the current data
      setLoadingAccount(false)
      toast.success('Key imported successfully')
      // Navigate back to multisig setup (just one screen back)
      router.back()
    } catch (error) {
      setLoadingAccount(false)
      toast.error(`Failed to set key: ${(error as Error).message}`)
    }
  }

  async function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)

    if (syncedAccount && !loadingAccount) {
      clearAccount()
      router.dismissAll()
      router.replace(
        '/(authenticated)/(tabs)/(signer,explorer,converter)/' as any
      )
    }
  }

  function handleOnPressCancel() {
    if (policyType === 'multisig') {
      router.dismiss(1)
    } else {
      router.dismiss(Number(keyIndex) + 3)
    }
    clearKeyState()
  }

  if (accountImported) return <Redirect href="/" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <ScrollView>
        <SSSeedWordsInput
          wordCount={mnemonicWordCount}
          network={network as Network}
          onMnemonicValid={handleMnemonicValid}
          onMnemonicInvalid={handleMnemonicInvalid}
          showPassphrase
          showChecksum
          showFingerprint
          showPasteButton
          showActionButton
          actionButtonLabel={t('account.import.title2')}
          actionButtonVariant="secondary"
          onActionButtonPress={() =>
            policyType === 'multisig'
              ? handleOnPressImportSeedMultisig()
              : handleOnPressImportSeed()
          }
          actionButtonDisabled={!currentMnemonic || accountImported}
          actionButtonLoading={loadingAccount}
          cancelButtonLabel={t('common.cancel')}
          onCancelButtonPress={handleOnPressCancel}
          showCancelButton
          autoCheckClipboard
        />
      </ScrollView>
      <SSGradientModal
        visible={accountAddedModalVisible}
        closeText={
          syncedAccount && !loadingAccount
            ? t('account.gotoWallet')
            : t('common.close')
        }
        onClose={() => handleOnCloseAccountAddedModal()}
      >
        <SSVStack style={{ marginVertical: 32, width: '100%' }}>
          <SSVStack itemsCenter gap="xs">
            <SSText color="white" size="2xl">
              {name}
            </SSText>
            <SSText color="muted" size="lg">
              {t('account.added')}
            </SSText>
          </SSVStack>
          <SSSeparator />
          <SSHStack justifyEvenly style={{ alignItems: 'flex-start' }}>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {t('account.script')}
              </SSText>
              <SSText size="md" color="muted" center>
                {getScriptVersionDisplayName(scriptVersion)}
              </SSText>
            </SSVStack>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {t('account.fingerprint')}
              </SSText>
              <SSText size="md" color="muted">
                {fingerprint}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSSeparator />
          <SSVStack>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {t('account.derivationPath')}
              </SSText>
              <SSText size="md" color="muted">
                {syncedAccount?.keys[Number(keyIndex)].derivationPath ||
                  keys[Number(keyIndex)]?.derivationPath ||
                  '-'}
              </SSText>
            </SSVStack>
            <SSHStack justifyEvenly>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {t('account.utxos')}
                </SSText>
                {loadingAccount || !syncedAccount ? (
                  <SSEllipsisAnimation />
                ) : (
                  <SSText size="md" color="muted">
                    {syncedAccount.summary.numberOfUtxos}
                  </SSText>
                )}
              </SSVStack>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {t('bitcoin.sats')}
                </SSText>
                {loadingAccount || !syncedAccount ? (
                  <SSEllipsisAnimation />
                ) : (
                  <SSText size="md" color="muted">
                    {syncedAccount.summary.balance}
                  </SSText>
                )}
              </SSVStack>
            </SSHStack>
            <SSHStack>
              {walletSyncFailed && (
                <SSText size="3xl" color="muted" center>
                  {t('account.syncFailed')}
                </SSText>
              )}
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSGradientModal>
    </SSMainLayout>
  )
}
