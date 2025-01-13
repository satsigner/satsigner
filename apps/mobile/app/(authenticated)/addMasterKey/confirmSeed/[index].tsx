import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconCheckCircle,
  SSIconCircleX,
  SSIconHideWarning
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSGradientModal from '@/components/SSGradientModal'
import SSText from '@/components/SSText'
import SSWarningModal from '@/components/SSWarningModal'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { getConfirmWordCandidates } from '@/utils/seed'

type ConfirmSeedSearchParams = {
  index: string
}

export default function ConfirmSeed() {
  const router = useRouter()
  const { index } = useLocalSearchParams<ConfirmSeedSearchParams>()

  const [syncWallet, addAccount, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.syncWallet,
      state.addAccount,
      state.updateAccount
    ])
  )
  const [
    name,
    seedWordCount,
    seedWords,
    clearAccount,
    getAccount,
    loadWallet,
    lockSeed
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.seedWordCount,
      state.seedWords,
      state.clearAccount,
      state.getAccount,
      state.loadWallet,
      state.lockSeed
    ])
  )

  const candidateWords = useMemo(() => {
    return getConfirmWordCandidates(seedWords[+index], seedWords)
  }, [seedWords, index])

  const [selectedCheckbox, setSelectedCheckbox] = useState<1 | 2 | 3>()

  const [loadingAccount, setLoadingAccount] = useState(false)

  const [incorrectWordModalVisible, setIncorrectWordModalVisible] =
    useState(false)
  const [warningModalVisible, setWarningModalVisible] = useState(false)
  const [walletSyncFailed, setWalletSyncFailed] = useState(false)

  async function handleNavigateNextWord() {
    if (!seedWordCount || !selectedCheckbox) return

    if (candidateWords[selectedCheckbox - 1] !== seedWords[+index])
      return setIncorrectWordModalVisible(true)

    if (+index + 1 < seedWordCount)
      router.push(`/addMasterKey/confirmSeed/${+index + 1}`)
    else return handleFinishWordsConfirmation()
  }

  async function handleFinishWordsConfirmation() {
    setLoadingAccount(true)

    const wallet = await loadWallet()

    const account = getAccount()
    addAccount(account)

    try {
      const syncedAccount = await syncWallet(wallet, account)
      updateAccount(syncedAccount)
      lockSeed()
    } catch {
      setWalletSyncFailed(true)
    } finally {
      setLoadingAccount(false)
      setWarningModalVisible(true)
    }
  }

  function handleCloseWordsWarning() {
    setWarningModalVisible(false)
    clearAccount()
    router.navigate('/')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
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
              selected={selectedCheckbox === 1}
              onPress={() => setSelectedCheckbox(1)}
            />
            <SSCheckbox
              label={candidateWords[1]}
              selected={selectedCheckbox === 2}
              onPress={() => setSelectedCheckbox(2)}
            />
            <SSCheckbox
              label={candidateWords[2]}
              selected={selectedCheckbox === 3}
              onPress={() => setSelectedCheckbox(3)}
            />
          </SSVStack>
        </SSVStack>
        <SSVStack>
          <SSButton
            label={i18n.t('common.next')}
            variant="secondary"
            loading={loadingAccount}
            disabled={!selectedCheckbox}
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
          <SSIconCircleX height={88} width={88} />
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
            <SSIconCheckCircle height={30} width={30} />
            <SSText size="3xl">
              {seedWordCount} {i18n.t('common.of').toLowerCase()}{' '}
              {seedWordCount}
            </SSText>
          </SSHStack>
          <SSText uppercase center>
            {i18n.t('bitcoin.notYourKeys')}
            {'\n'}
            {i18n.t('bitcoin.notYourCoins')}
          </SSText>
          <SSText size="6xl">{i18n.t('common.warning')}</SSText>
          <SSIconHideWarning height={132} width={210} />
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
          {walletSyncFailed && (
            <SSText size="3xl" color="muted" center>
              {i18n.t('addMasterKey.walletSyncFailed')}
            </SSText>
          )}
        </SSVStack>
      </SSWarningModal>
    </SSMainLayout>
  )
}
