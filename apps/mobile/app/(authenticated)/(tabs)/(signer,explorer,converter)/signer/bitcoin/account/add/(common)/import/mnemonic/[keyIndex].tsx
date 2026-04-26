import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'
import SSText from '@/components/SSText'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { type ImportMnemonicSearchParams } from '@/types/navigation/searchParams'
import { getExtendedPublicKeyFromMnemonic } from '@/utils/bip39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'

export default function ImportMnemonic() {
  const { keyIndex } = useLocalSearchParams<ImportMnemonicSearchParams>()
  const router = useRouter()
  const [
    name,
    scriptVersion,
    mnemonicWordCount,
    mnemonicWordList,
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
      state.scriptVersion,
      state.mnemonicWordCount,
      state.mnemonicWordList,
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
  const [currentMnemonic, setCurrentMnemonic] = useState('')
  const [currentFingerprint, setCurrentFingerprint] = useState('')

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

      const createdAccountId = data.accountWithEncryptedSecret.id
      clearAccount()
      router.navigate(`/signer/bitcoin/account/add/created/${createdAccountId}`)
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
      />
    </SSMainLayout>
  )
}
