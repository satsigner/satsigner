import { type Network } from 'bdk-rn/lib/lib/enums'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWallet } from '@/api/bdk'
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
import { PIN_KEY } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type ConfirmWordSearchParams } from '@/types/navigation/searchParams'
import { aesEncrypt } from '@/utils/crypto'
import { getConfirmWordCandidates } from '@/utils/seed'

export default function Confirm() {
  const router = useRouter()
  const { keyIndex, index } = useLocalSearchParams<ConfirmWordSearchParams>()

  const [syncWallet, addAccount, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.syncWallet,
      state.addAccount,
      state.updateAccount
    ])
  )
  const [
    name,
    mnemonicWordCount,
    mnemonic,
    policyType,
    clearAccount,
    getAccount,
    loadWallet,
    encryptSeed,
    setParticipantWithSeedWord,
    setKeyCount,
    setKeysRequired,
    getAccountData,
    appendKey,
    updateKeySecret,
    updateKeyFingerprint,
    setKeyDerivationPath
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.mnemonicWordCount,
      state.mnemonic.split(' '),
      state.policyType,
      state.clearAccount,
      state.getAccount,
      state.loadWallet,
      state.encryptSeed,
      state.setParticipantWithSeedWord,
      state.setKeyCount,
      state.setKeysRequired,
      state.getAccountData,
      state.appendKey,
      state.updateKeySecret,
      state.updateKeyFingerprint,
      state.setKeyDerivationPath
    ])
  )
  const addAccountWallet = useWalletsStore((state) => state.addAccountWallet)
  const network = useBlockchainStore((state) => state.network)

  const candidateWords = useMemo(() => {
    return getConfirmWordCandidates(mnemonic[Number(index)], mnemonic.join(' '))
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedCheckbox, setSelectedCheckbox] = useState<1 | 2 | 3>()

  const [loadingAccount, setLoadingAccount] = useState(false)

  const [incorrectWordModalVisible, setIncorrectWordModalVisible] =
    useState(false)
  const [warningModalVisible, setWarningModalVisible] = useState(false)

  const [walletSyncFailed, setWalletSyncFailed] = useState(false)

  async function handleNavigateNextWord() {
    if (!selectedCheckbox) return

    if (candidateWords[selectedCheckbox - 1] !== mnemonic[Number(index)])
      return setIncorrectWordModalVisible(true)

    if (Number(index) + 1 < mnemonicWordCount)
      router.push(`/account/add/confirm/${keyIndex}/word/${Number(index) + 1}`)
    else return handleFinishWordsConfirmation()
  }

  async function handleFinishWordsConfirmation() {
    appendKey(Number(keyIndex))

    if (policyType === 'singlesig') {
      setLoadingAccount(true)
      setKeyCount(1)
      setKeysRequired(1)

      const account = getAccountData()

      const walletData = await getWallet(account, network as Network)
      if (!walletData) return // TODO: handle error

      addAccountWallet(account.id, walletData.wallet)

      const stringifiedSecret = JSON.stringify(account.keys[0].secret)
      const pin = await getItem(PIN_KEY)
      if (!pin) return // TODO: handle error

      const encryptedSecret = await aesEncrypt(
        stringifiedSecret,
        pin,
        account.keys[0].iv
      )

      updateKeyFingerprint(0, walletData.fingerprint)
      setKeyDerivationPath(0, walletData.derivationPath)
      updateKeySecret(0, encryptedSecret)

      const accountWithEncryptedSecret = getAccountData()

      addAccount(accountWithEncryptedSecret)

      // await walletData.wallet.sync()

      try {
        // const syncedAccount = await syncWallet(wallet, account)
        // await updateAccount(syncedAccount)
      } catch {
        setWalletSyncFailed(true)
      } finally {
        setLoadingAccount(false)
        setWarningModalVisible(true)
      }
    } else if (policyType === 'multisig') {
      setParticipantWithSeedWord()
      router.dismiss(Number(index) + 2)
    }
  }

  function handleCloseWordsWarning() {
    setWarningModalVisible(false)
    clearAccount()
    router.navigate('/')
  }

  function handleOnPressCancel() {
    if (policyType === 'multisig') {
      router.dismiss(Number(index) + 1)
    } else if (policyType === 'singlesig') {
      router.replace('/')
    }
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
            variant="ghost"
            onPress={handleOnPressCancel}
          />
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
        <SSVStack itemsCenter>
          <SSHStack>
            <SSIconCheckCircle height={30} width={30} />
            <SSText size="3xl">
              {mnemonicWordCount} {t('common.of').toLowerCase()}{' '}
              {mnemonicWordCount}
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
          {walletSyncFailed && (
            <SSText size="3xl" color="muted" center>
              {t('account.syncFailed')}
            </SSText>
          )}
        </SSVStack>
      </SSWarningModal>
    </SSMainLayout>
  )
}
