import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getExtendedPublicKeyFromAccountKey } from '@/api/bdk'
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
import { type SeedWordInfo } from '@/types/logic/seedWord'
import { type Account } from '@/types/models/Account'
import { type ImportMnemonicSearchParams } from '@/types/navigation/searchParams'
import {
  convertMnemonic,
  getFingerprintFromMnemonic,
  getWordList,
  validateMnemonic
} from '@/utils/bip39'
import { getScriptVersionDisplayName } from '@/utils/scripts'
import { seedWordsPrefixOfAnother } from '@/utils/seed'

const MIN_LETTERS_TO_SHOW_WORD_SELECTOR = 2

export default function ImportMnemonic() {
  const { keyIndex } = useLocalSearchParams<ImportMnemonicSearchParams>()
  const router = useRouter()
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const {
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
    setPassphrase,
    setFingerprint,
    setExtendedPublicKey,
    getAccountData,
    clearKeyState
  } = useAccountBuilderStore(useShallow((state) => state))
  const [network, connectionMode] = useBlockchainStore(
    useShallow((state) => [
      state.selectedNetwork,
      state.configs[state.selectedNetwork].config.connectionMode
    ])
  )
  const { accountBuilderFinish } = useAccountBuilderFinish()
  const { syncAccountWithWallet } = useSyncAccountWithWallet()

  const wordList = getWordList(mnemonicWordList)

  const [mnemonicWordsInfo, setMnemonicWordsInfo] = useState<SeedWordInfo[]>(
    [...Array(mnemonicWordCount)].map((_, index) => ({
      value: '',
      index,
      dirty: false,
      valid: false
    }))
  )
  const [checksumValid, setChecksumValid] = useState(false)
  const [currentWordText, setCurrentWordText] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)

  const [loadingAccount, setLoadingAccount] = useState(false)
  const [accountImported, setAccountImported] = useState(false)
  const [syncedAccount, setSyncedAccount] = useState<Account>()
  const [walletSyncFailed, setWalletSyncFailed] = useState(false)
  const [currentMnemonic, setCurrentMnemonic] = useState('')
  const [currentFingerprint, setCurrentFingerprint] = useState('')

  const [accountAddedModalVisible, setAccountAddedModalVisible] =
    useState(false)

  function checkTextHasSeed(text: string): Promise<string[]> {
    if (text === null || text === '') return []
    const delimiters = [' ', '\n']

    for (const delimiter of delimiters) {
      const seedCandidate = text.split(delimiter)

      // validate seed length
      if (seedCandidate.length !== mnemonicWordCount) continue

      // validate words from word list
      const validWords = seedCandidate.every((x) => wordList.includes(x))
      if (!validWords) continue

      // convert mnemonic into english before validating its checksum
      const convertedSeed = convertMnemonic(
        seedCandidate.join(' '),
        'english',
        mnemonicWordList
      )

      // validate checksum
      const checksum = validateMnemonic(convertedSeed)
      if (!checksum) continue

      return seedCandidate
    }
    return []
  }

  function fillOutSeedWords(seed: string[]) {
    const localMnemonic = seed.join(' ')

    const mnemonic = convertMnemonic(localMnemonic, 'english', mnemonicWordList)

    setMnemonicWordsInfo(
      seed.map((value, index) => {
        return { value, index, dirty: false, valid: true }
      })
    )

    if (passphraseRef.current) passphraseRef.current.focus()

    const checksumValid = validateMnemonic(mnemonic)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setMnemonic(mnemonic)
      const fingerprint = getFingerprintFromMnemonic(
        mnemonic,
        passphrase,
        network as Network
      )

      setFingerprint(fingerprint)
    }
  }

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
    setKey(Number(keyIndex))

    const account = getAccountData()
    const data = await accountBuilderFinish(account)
    if (!data || !data.wallet) {
      setLoadingAccount(false)
      toast.error('Failed to create account')
      return
    }

    seedWord.value = word.trim()

    if (wordList.includes(word)) seedWord.valid = true
    else {
      seedWord.valid = false
      setKeyboardWordSelectorVisible(
        word.length >= MIN_LETTERS_TO_SHOW_WORD_SELECTOR
      )
    }

    setCurrentWordText(word)
    setMnemonicWordsInfo(seedWords)

    const localMnemonic = mnemonicWordsInfo
      .map((mnemonicWord) => mnemonicWord.value)
      .join(' ')

    // convert mnemonic to english
    const mnemonic = convertMnemonic(localMnemonic, 'english', mnemonicWordList)

    const checksumValid = validateMnemonic(mnemonic)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setMnemonic(mnemonic)
      const fingerprint = getFingerprintFromMnemonic(
        mnemonic,
        passphrase,
        network as Network
      )

      setFingerprint(fingerprint)
    }

    if (seedWord.valid && !seedWordsPrefixOfAnother[word]) {
      focusNextWord(index)
    }
  }

  function focusNextWord(currentIndex: number) {
    const nextIndex = currentIndex + 1
    if (nextIndex < mnemonicWordCount) {
      inputRefs.current[nextIndex]?.focus()
    } else if (passphraseRef.current) {
      passphraseRef.current.focus()
    }
  }

  function handleOnEndEditingWord(word: string, index: number) {
    const mnemonic = [...mnemonicWordsInfo]
    const mnemonicWord = mnemonic[index]

    mnemonicWord.value = word
    mnemonicWord.valid = wordList.includes(word)
    mnemonicWord.dirty ||= word.length > 0

    setMnemonicWordsInfo(mnemonic)
    setCurrentWordText(word)
  }

  function handleOnFocusWord(word: string | undefined, index: number) {
    const seedWords = [...mnemonicWordsInfo]
    const seedWord = seedWords[index]

    setCurrentWordText(word || '')
    setCurrentWordIndex(index)
    setKeyboardWordSelectorVisible(
      !seedWord.valid &&
        (word?.length || 0) >= MIN_LETTERS_TO_SHOW_WORD_SELECTOR
    )
  }

  async function handleOnWordSelected(word: string) {
    const seedWords = [...mnemonicWordsInfo]
    seedWords[currentWordIndex].value = word

    if (wordList.includes(word)) {
      seedWords[currentWordIndex].valid = true
      setKeyboardWordSelectorVisible(false)
    }

    setMnemonicWordsInfo(seedWords)

    const mnemonicSeedWords = seedWords
      .map((seedWord) => seedWord.value)
      .join(' ')

    const mnemonic = convertMnemonic(
      mnemonicSeedWords,
      'english',
      mnemonicWordList
    )

    const checksumValid = await validateMnemonic(mnemonic)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setMnemonic(mnemonic)
      const fingerprint = await getFingerprint(
        mnemonic,
        passphrase,
        network as Network
      )

      setFingerprint(fingerprint)
    }
    focusNextWord(currentWordIndex)
  }

  async function handleUpdatePassphrase(passphrase: string) {
    setPassphrase(passphrase)

    const mnemonicSeedWords = mnemonicWordsInfo
      .map((word) => word.value)
      .join(' ')

    const mnemonic = convertMnemonic(
      mnemonicSeedWords,
      'english',
      mnemonicWordList
    )

    const checksumValid = validateMnemonic(mnemonic)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setMnemonic(mnemonic)
      const fingerprint = getFingerprintFromMnemonic(
        mnemonic,
        passphrase,
        network as Network
      )

      setFingerprint(fingerprint)
    }
  }

  // Handle seed import for multisig (just create the key)
  async function handleOnPressImportSeedMultisig() {
    setLoadingAccount(true)

    const mnemonicSeedWords = mnemonicWordsInfo
      .map((word) => word.value)
      .join(' ')

    const mnemonic = convertMnemonic(
      mnemonicSeedWords,
      'english',
      mnemonicWordList
    )

    setMnemonic(mnemonic)

    const currentKey = setKey(Number(keyIndex))

    if (policyType === 'singlesig') {
      const account = getAccountData()

      const data = await accountBuilderFinish(account)
      if (!data || !data.wallet) return

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
        setAccountImported(true)
        setLoadingAccount(false)
      }
    } else if (policyType === 'multisig') {
      const extendedPublicKey = await getExtendedPublicKeyFromAccountKey(
        currentKey,
        network as Network
      )

      // Set the extended public key
      setExtendedPublicKey(extendedPublicKey)

      // Set the key with the current data
      setKey(Number(keyIndex))
      setLoadingAccount(false)
      toast.success('Key imported successfully')
      // Navigate back to multisig setup (just one screen back)
      router.back()
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
