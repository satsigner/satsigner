import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconCheckCircle,
  SSIconCircleX,
  SSIconHideWarning,
  SSIconWarning
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSGradientModal from '@/components/SSGradientModal'
import SSModal from '@/components/SSModal'
import SSScreenCaptureGuard from '@/components/SSScreenCaptureGuard'
import SSText from '@/components/SSText'
import SSWarningModal from '@/components/SSWarningModal'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useSettingsStore } from '@/store/settings'
import { type ConfirmWordSearchParams } from '@/types/navigation/searchParams'
import { getConfirmWordCandidates } from '@/utils/seed'

// A failed account creation must leave the screen usable, not spinning.
async function settleOrUndefined<T>(work: Promise<T>): Promise<T | undefined> {
  try {
    return await work
  } catch {
    return undefined
  }
}

export default function Confirm() {
  const router = useRouter()
  const { keyIndex, index } = useLocalSearchParams<ConfirmWordSearchParams>()
  const [
    name,
    mnemonicWordCount,
    mnemonicString,
    policyType,
    clearAccount,
    getAccountData,
    setKey,
    clearKeyState
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.mnemonicWordCount,
      state.mnemonic,
      state.policyType,
      state.clearAccount,
      state.getAccountData,
      state.setKey,
      state.clearKeyState
    ])
  )
  const mnemonic = mnemonicString.split(' ')

  const skipSeedConfirmation = useSettingsStore(
    (state) => state.skipSeedConfirmation
  )
  const { accountBuilderFinish } = useAccountBuilderFinish()

  const [candidateWords] = useState(() =>
    getConfirmWordCandidates(mnemonic[Number(index)], mnemonic.join(' '))
  )

  const [selectedCheckbox, setSelectedCheckbox] = useState<1 | 2 | 3>()

  const [loadingAccount, setLoadingAccount] = useState(false)
  // Set synchronously, so Skip and the last word tapped in one frame cannot
  // both start a finish.
  const finishing = useRef(false)
  const [createdAccountId, setCreatedAccountId] = useState<string>()

  const [incorrectWordModalVisible, setIncorrectWordModalVisible] =
    useState(false)
  const [warningModalVisible, setWarningModalVisible] = useState(false)
  const [skipModalVisible, setSkipModalVisible] = useState(false)
  const [localMnemonicWordCount, setLocalMnemonicWordCount] =
    useState(mnemonicWordCount)

  function handleOnPressSkip() {
    setSkipModalVisible(true)
  }

  async function handleConfirmSkip() {
    setSkipModalVisible(false)
    await handleFinishWordsConfirmation()
  }

  function finishKeyDraft() {
    setLocalMnemonicWordCount(mnemonicWordCount)
    clearKeyState()
  }

  function handleNavigateNextWord() {
    if (!selectedCheckbox) {
      return
    }

    if (candidateWords[selectedCheckbox - 1] !== mnemonic[Number(index)]) {
      return setIncorrectWordModalVisible(true)
    }

    if (Number(index) + 1 < mnemonicWordCount) {
      router.push(
        `/signer/bitcoin/account/add/confirm/${keyIndex}/word/${Number(index) + 1}`
      )
    } else {
      return handleFinishWordsConfirmation()
    }
  }

  // Runs once: Skip and the last word both lead here, and a second run would
  // create the account twice.
  async function handleFinishWordsConfirmation() {
    if (finishing.current) {
      return
    }
    if (policyType === 'multisig') {
      // Extended public key is already generated in the mnemonic step
      // Just set the key and continue
      setKey(Number(keyIndex))
      router.dismissTo('/signer/bitcoin/account/add/multiSig/manager')
      finishKeyDraft()
      return
    }
    if (policyType !== 'singlesig') {
      return
    }

    finishing.current = true
    setLoadingAccount(true)
    const data = await settleOrUndefined(accountBuilderFinish(getAccountData()))
    setLoadingAccount(false)
    finishing.current = false
    const accountId = data?.accountWithEncryptedSecret.id
    if (!accountId) {
      toast.error(t('account.import.error.generic'))
      return
    }
    setCreatedAccountId(accountId)
    setWarningModalVisible(true)
    finishKeyDraft()
  }

  function handleCloseWordsWarning() {
    setWarningModalVisible(false)
    clearAccount()
    router.dismissAll()
    if (createdAccountId) {
      router.navigate(`/signer/bitcoin/account/${createdAccountId}`)
    }
  }

  // Multisig goes back to the key's word grid, which still needs the
  // mnemonic; only leaving the flow clears it.
  function handleOnPressCancel() {
    if (policyType === 'multisig') {
      router.dismiss(Number(index) + 1)
    } else if (policyType === 'singlesig') {
      useAccountBuilderStore.getState().clearKeyState()
      router.replace('/')
    }
  }

  return (
    <SSMainLayout>
      <SSScreenCaptureGuard />
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSVStack justifyBetween>
        <SSVStack gap="lg">
          <SSText color="white" uppercase style={{ alignSelf: 'center' }}>
            {`${t('common.confirm')} ${t('bitcoin.word')} ${Number(index) + 1}`}
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
            label={t('common.next')}
            variant="secondary"
            loading={loadingAccount}
            disabled={!selectedCheckbox}
            onPress={handleNavigateNextWord}
          />
          <SSButton
            label={t('common.cancel')}
            variant="subtle"
            onPress={handleOnPressCancel}
          />
          {skipSeedConfirmation && (
            <SSButton
              label={t('common.skip')}
              variant="ghost"
              onPress={handleOnPressSkip}
            />
          )}
        </SSVStack>
      </SSVStack>
      <SSGradientModal
        visible={incorrectWordModalVisible}
        closeText={t('account.confirmSeed.tryAgain')}
        onClose={() => setIncorrectWordModalVisible(false)}
      >
        <SSVStack itemsCenter style={{ marginVertical: 32 }}>
          <SSIconCircleX height={88} width={88} />
          <SSText size="3xl" center style={{ maxWidth: 200 }}>
            {t('account.confirmSeed.warning')}
          </SSText>
        </SSVStack>
      </SSGradientModal>
      <SSWarningModal
        visible={warningModalVisible}
        onClose={handleCloseWordsWarning}
      >
        <SSVStack itemsCenter style={{ marginBottom: 20 }}>
          <SSHStack>
            <SSIconCheckCircle height={30} width={30} />
            <SSText size="3xl">
              {localMnemonicWordCount} {t('common.of').toLowerCase()}{' '}
              {localMnemonicWordCount}
            </SSText>
          </SSHStack>
          <SSText uppercase center>
            {t('bitcoin.notYourKeys')}
            {'\n'}
            {t('bitcoin.notYourCoins')}
          </SSText>
          <SSText size="6xl">{t('common.warning')}</SSText>
          <SSIconHideWarning height={132} width={210} />
          <SSText size="2xl" center style={{ maxWidth: 260 }}>
            {t('account.generate.warning')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {t('account.generate.disclaimer.1')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {t('account.generate.disclaimer.2')}
          </SSText>
          <SSText size="xl" color="muted" center>
            {t('account.generate.disclaimer.3')}
          </SSText>
        </SSVStack>
      </SSWarningModal>
      <SSModal
        visible={skipModalVisible}
        onClose={() => setSkipModalVisible(false)}
      >
        <SSVStack style={styles.skipModalContainer} itemsCenter>
          <SSHStack>
            <SSIconWarning height={22} width={22} />
            <SSText uppercase size="xl" weight="bold">
              {t('common.warning')}
            </SSText>
            <SSIconWarning height={22} width={22} />
          </SSHStack>
          <SSText>{t('account.confirmSeed.confirmSkip')}</SSText>
          <SSButton
            label={t('common.yes')}
            variant="danger"
            onPress={handleConfirmSkip}
          />
          <SSButton
            label={t('common.no')}
            onPress={() => setSkipModalVisible(false)}
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  skipModalContainer: {
    height: '100%',
    justifyContent: 'center',
    width: '100%'
  }
})
