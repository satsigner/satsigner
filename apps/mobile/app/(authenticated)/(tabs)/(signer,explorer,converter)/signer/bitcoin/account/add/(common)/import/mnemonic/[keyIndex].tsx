import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSGradientModal from '@/components/SSGradientModal'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type ImportMnemonicSearchParams } from '@/types/navigation/searchParams'
import { getExtendedPublicKeyFromMnemonic } from '@/utils/bip39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getScriptVersionDisplayName } from '@/utils/scripts'
import SSFingerprint from '@/components/SSFingerprint'

export default function ImportMnemonic() {
  const { keyIndex } = useLocalSearchParams<ImportMnemonicSearchParams>()
  const router = useRouter()
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
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { accountBuilderFinish } = useAccountBuilderFinish()

  const [createdAccountId, setCreatedAccountId] = useState<string>()
  const [currentMnemonic, setCurrentMnemonic] = useState('')
  const [currentFingerprint, setCurrentFingerprint] = useState('')

  const [accountAddedModalVisible, setAccountAddedModalVisible] =
    useState(false)

  const [wordSelectorState, setWordSelectorState] = useState({
    onWordSelected: () => {
      // noop
    },
    visible: false,
    wordStart: ''
  })

  const handleMnemonicValid = (mnemonic: string, fingerprint: string) => {
    setCurrentMnemonic(mnemonic)
    setCurrentFingerprint(fingerprint)
  }

  const handleMnemonicInvalid = () => {
    setCurrentMnemonic('')
    setCurrentFingerprint('')
  }

  async function handleOnPressImportSeed() {
    setMnemonic(currentMnemonic)
    setFingerprint(currentFingerprint)
    setKey(Number(keyIndex))

    try {
      const account = getAccountData()
      const data = await accountBuilderFinish(account)

      if (!data || !data.wallet) {
        toast.error(t('account.import.error.generic'))
        return
      }

      setCreatedAccountId(data.accountWithEncryptedSecret.id)
      setAccountAddedModalVisible(true)
    } catch (error) {
      toast.error((error as Error).message || t('account.import.error.generic'))
    }
  }

  function handleOnPressImportSeedMultisig() {
    setMnemonic(currentMnemonic)
    setFingerprint(currentFingerprint)

    if (currentMnemonic && currentFingerprint) {
      const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
        currentMnemonic,
        passphrase || '',
        appNetworkToBdkNetwork(network),
        scriptVersion
      )
      setExtendedPublicKey(extendedPublicKey)
    }

    setKey(Number(keyIndex))
    clearKeyState()
    toast.success('Key imported successfully')
    router.back()
  }

  function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)

    if (createdAccountId) {
      clearAccount()
      router.dismissAll()
      router.navigate(`/signer/bitcoin/account/${createdAccountId}`)
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
          network={appNetworkToBdkNetwork(network)}
          onMnemonicValid={handleMnemonicValid}
          onMnemonicInvalid={handleMnemonicInvalid}
          showPassphrase
          showChecksum
          showFingerprint
          showPasteButton
          showScanSeedQRButton
          showActionButton
          actionButtonLabel={t('account.import.title2')}
          actionButtonVariant="secondary"
          onActionButtonPress={() =>
            policyType === 'multisig'
              ? handleOnPressImportSeedMultisig()
              : handleOnPressImportSeed()
          }
          actionButtonDisabled={!currentMnemonic}
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
        closeText={t('account.gotoWallet')}
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
              <SSFingerprint fingerprint={fingerprint} />
            </SSVStack>
          </SSHStack>
          <SSSeparator />
          <SSVStack itemsCenter>
            <SSText style={{ color: Colors.gray[500] }}>
              {t('account.derivationPath')}
            </SSText>
            <SSText size="md" color="muted">
              {keys[Number(keyIndex)]?.derivationPath || '-'}
            </SSText>
          </SSVStack>
        </SSVStack>
      </SSGradientModal>
    </SSMainLayout>
  )
}
