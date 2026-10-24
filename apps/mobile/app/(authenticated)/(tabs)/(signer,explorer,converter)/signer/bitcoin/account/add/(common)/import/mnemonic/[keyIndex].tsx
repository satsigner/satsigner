import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSSeedWordsEntry from '@/components/SSSeedWordsEntry'
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
    setPassphrase,
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
      state.setPassphrase,
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
  const [currentPassphrase, setCurrentPassphrase] = useState('')

  const handleMnemonicValid = (
    mnemonic: string,
    fingerprint: string,
    passphrase: string
  ) => {
    setCurrentMnemonic(mnemonic)
    setCurrentFingerprint(fingerprint)
    setCurrentPassphrase(passphrase)
  }

  const handleMnemonicInvalid = () => {
    setCurrentMnemonic('')
    setCurrentFingerprint('')
  }

  async function handleOnPressImportSeed() {
    setMnemonic(currentMnemonic)
    setPassphrase(currentPassphrase)
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
      router.navigate(`/signer/bitcoin/account/add/created/${createdAccountId}`)

      // we clear the account in the background to avoid an immediate re-render of the current page which resets its state variables
      setTimeout(clearAccount, 1500)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`${t('account.import.error.generic')}: ${reason}`)
    }
  }

  function handleOnPressImportSeedMultisig() {
    setMnemonic(currentMnemonic)
    setPassphrase(currentPassphrase)
    setFingerprint(currentFingerprint)

    if (currentMnemonic && currentFingerprint) {
      const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
        currentMnemonic,
        currentPassphrase,
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
      <SSSeedWordsEntry
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
      />
    </SSMainLayout>
  )
}
