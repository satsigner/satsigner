import { type Network } from 'bdk-rn/lib/lib/enums'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSEllipsisAnimation from '@/components/SSEllipsisAnimation'
import SSGradientModal from '@/components/SSGradientModal'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
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
  const [
    name,
    keys,
    scriptVersion,
    mnemonicWordCount,
    mnemonicWordList,
    fingerprint,
    policyType,
    clearAccount,
    setMnemonic,
    setKey,
    passphrase,
    setFingerprint,
    setExtendedPublicKey,
    getAccountData,
    clearKeyState
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.keys,
      state.scriptVersion,
      state.mnemonicWordCount,
      state.mnemonicWordList,
      state.fingerprint,
      state.policyType,
      state.clearAccount,
      state.setMnemonic,
      state.setKey,
      state.passphrase,
      state.setFingerprint,
      state.setExtendedPublicKey,
      state.getAccountData,
      state.clearKeyState
    ])
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
  const [syncedAccount, setSyncedAccount] = useState<Account>()
  const [walletSyncFailed, setWalletSyncFailed] = useState(false)
  const [currentMnemonic, setCurrentMnemonic] = useState('')
  const [currentFingerprint, setCurrentFingerprint] = useState('')

  const [accountAddedModalVisible, setAccountAddedModalVisible] =
    useState(false)

  const [wordSelectorState, setWordSelectorState] = useState({
    visible: false,
    wordStart: '',
    onWordSelected: () => {}
  })

  // Handle mnemonic validation from the component
  const handleMnemonicValid = (mnemonic: string, fingerprint: string) => {
    setCurrentMnemonic(mnemonic)
    setCurrentFingerprint(fingerprint)
  }

  const handleMnemonicInvalid = () => {
    setCurrentMnemonic('')
    setCurrentFingerprint('')
  }

  async function handleOnPressImportSeed() {
    setLoadingAccount(true)
    setMnemonic(currentMnemonic)
    setFingerprint(currentFingerprint)
    setKey(Number(keyIndex))

    const account = getAccountData()
    const data = await accountBuilderFinish(account)
    if (!data || !data.wallet) {
      setLoadingAccount(false)
      toast.error('Failed to wrap up account creation data')
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
    } catch (error) {
      setWalletSyncFailed(true)
      toast.error((error as Error).message)
    } finally {
      setLoadingAccount(false)
    }
  }

  async function handleOnPressImportSeedMultisig() {
    setLoadingAccount(true)
    setMnemonic(currentMnemonic)
    setFingerprint(currentFingerprint)

    if (currentMnemonic && currentFingerprint) {
      const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
        currentMnemonic,
        passphrase || '',
        network as Network,
        scriptVersion
      )
      setExtendedPublicKey(extendedPublicKey)
    }

    setKey(Number(keyIndex))
    clearKeyState()
    setLoadingAccount(false)
    toast.success('Key imported successfully')
    router.back()
  }

  async function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)

    if (syncedAccount && !loadingAccount) {
      clearAccount()
      router.dismissAll()
      router.navigate(`/signer/bitcoin/account/${syncedAccount.id}`)
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
          wordListName={mnemonicWordList}
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
          actionButtonDisabled={!currentMnemonic}
          actionButtonLoading={loadingAccount}
          cancelButtonLabel={t('common.cancel')}
          onCancelButtonPress={handleOnPressCancel}
          showCancelButton
          autoCheckClipboard
          onWordSelectorStateChange={setWordSelectorState}
        />
      </ScrollView>
      <SSKeyboardWordSelector
        visible={wordSelectorState.visible}
        wordStart={wordSelectorState.wordStart}
        wordListName={mnemonicWordList}
        onWordSelected={wordSelectorState.onWordSelected}
        style={{ height: 60 }}
      />
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
