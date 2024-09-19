import { Image } from 'expo-image'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSGradientModal from '@/components/SSGradientModal'
import SSText from '@/components/SSText'
import SSWarningModal from '@/components/SSWarningModal'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { getConfirmWordCandidates } from '@/utils/seed'

type ConfirmSeedSearchParams = {
  index: string
}

export default function ConfirmSeed() {
  const router = useRouter()
  const { index } = useLocalSearchParams<ConfirmSeedSearchParams>()
  const [
    currentAccount,
    loadWalletFromMnemonic,
    syncWallet,
    getPopulatedAccount,
    saveAccount
  ] = useAccountStore(
    useShallow((state) => [
      state.currentAccount,
      state.loadWalletFromMnemonic,
      state.syncWallet,
      state.getPopulatedAccount,
      state.saveAccount
    ])
  )

  const candidateWords = useMemo(() => {
    if (!currentAccount.seedWords) return []
    return getConfirmWordCandidates(
      currentAccount.seedWords[+index],
      currentAccount.seedWords
    )
  }, [currentAccount.seedWords, index])

  const [selectedCheckbox1, setSelectedCheckbox1] = useState(false)
  const [selectedCheckbox2, setSelectedCheckbox2] = useState(false)
  const [selectedCheckbox3, setSelectedCheckbox3] = useState(false)
  const isWordSelected =
    selectedCheckbox1 || selectedCheckbox2 || selectedCheckbox3

  const [loadingAccount, setLoadingAccount] = useState(false)

  const [incorrectWordModalVisible, setIncorrectWordModalVisible] =
    useState(false)
  const [warningModalVisible, setWarningModalVisible] = useState(false)

  function handleSelectCheckbox(checkboxNumber: 1 | 2 | 3) {
    setSelectedCheckbox1(false)
    setSelectedCheckbox2(false)
    setSelectedCheckbox3(false)

    if (checkboxNumber === 1 && !selectedCheckbox1) setSelectedCheckbox1(true)
    if (checkboxNumber === 2 && !selectedCheckbox2) setSelectedCheckbox2(true)
    if (checkboxNumber === 3 && !selectedCheckbox3) setSelectedCheckbox3(true)
  }

  async function handleNavigateNextWord() {
    if (!currentAccount.seedWordCount || !currentAccount.seedWords) return

    const selectedWord = selectedCheckbox1
      ? candidateWords[0]
      : selectedCheckbox2
        ? candidateWords[1]
        : candidateWords[2]

    if (selectedWord !== currentAccount.seedWords[+index])
      return setIncorrectWordModalVisible(true)

    if (+index + 1 < currentAccount.seedWordCount)
      router.push(`/addMasterKey/confirmSeed/${+index + 1}`)
    else return handleFinishWordsConfirmation()
  }

  async function handleFinishWordsConfirmation() {
    if (!currentAccount.seedWords || !currentAccount.scriptVersion) return

    setLoadingAccount(true)

    const wallet = await loadWalletFromMnemonic(
      currentAccount.seedWords,
      currentAccount.scriptVersion,
      currentAccount.passphrase
    )

    await syncWallet(wallet)
    const account = await getPopulatedAccount(wallet, currentAccount)
    await saveAccount(account)

    setLoadingAccount(false)
    setWarningModalVisible(true)
  }

  function handleCloseWordsWarning() {
    setWarningModalVisible(false)
    router.navigate('/')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{currentAccount.name}</SSText>
        }}
      />
      <SSVStack justifyBetween>
        <SSVStack gap="lg">
          <SSText color="white" uppercase style={{ alignSelf: 'center' }}>
            {`${i18n.t('common.confirm')} ${i18n.t('bitcoin.word')} ${+index + 1}`}
          </SSText>
          <SSVStack gap="lg">
            <SSCheckbox
              label={candidateWords[0]}
              selected={selectedCheckbox1}
              onPress={() => handleSelectCheckbox(1)}
            />
            <SSCheckbox
              label={candidateWords[1]}
              selected={selectedCheckbox2}
              onPress={() => handleSelectCheckbox(2)}
            />
            <SSCheckbox
              label={candidateWords[2]}
              selected={selectedCheckbox3}
              onPress={() => handleSelectCheckbox(3)}
            />
          </SSVStack>
        </SSVStack>
        <SSVStack>
          <SSButton
            label={i18n.t('common.next')}
            variant="secondary"
            loading={loadingAccount}
            disabled={!isWordSelected}
            onPress={() => handleNavigateNextWord()}
          />
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
            onPress={() => router.replace('/')}
          />
        </SSVStack>
      </SSVStack>
      <SSGradientModal
        visible={incorrectWordModalVisible}
        closeText={i18n.t('addMasterKey.confirmSeed.incorrectWordModal.action')}
        onClose={() => setIncorrectWordModalVisible(false)}
      >
        <SSVStack itemsCenter style={{ marginVertical: 32 }}>
          <Image
            style={{ width: 88, height: 88 }}
            source={require('@/assets/icons/circle-x.svg')}
          />
          <SSText size="3xl" center style={{ maxWidth: 200 }}>
            {i18n.t('addMasterKey.confirmSeed.incorrectWordModal.warning')}
          </SSText>
        </SSVStack>
      </SSGradientModal>
      <SSWarningModal
        visible={warningModalVisible}
        onClose={() => handleCloseWordsWarning()}
      >
        <SSVStack itemsCenter>
          <SSHStack>
            <Image
              style={{ width: 30, height: 30 }}
              source={require('@/assets/icons/check-circle.svg')}
            />
            <SSText size="3xl">
              {currentAccount.seedWordCount} {i18n.t('common.of').toLowerCase()}{' '}
              {currentAccount.seedWordCount}
            </SSText>
          </SSHStack>
          <SSText uppercase center>
            {i18n.t('bitcoin.notYourKeys')}
            {'\n'}
            {i18n.t('bitcoin.notYourCoins')}
          </SSText>
          <SSText size="6xl">{i18n.t('common.warning')}</SSText>
          <Image
            style={{ width: 210, height: 132 }}
            source={require('@/assets/icons/hide-warning.svg')}
          />
          <SSText size="2xl" center style={{ maxWidth: 260 }}>
            {i18n.t('addMasterKey.confirmSeed.warningModal.warning')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {i18n.t('addMasterKey.confirmSeed.warningModal.disclaimer1')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {i18n.t('addMasterKey.confirmSeed.warningModal.disclaimer2')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {i18n.t('addMasterKey.confirmSeed.warningModal.disclaimer3')}
          </SSText>
        </SSVStack>
      </SSWarningModal>
    </SSMainLayout>
  )
}
