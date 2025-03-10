import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, ScrollView, type TextInput } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { getFingerprint, getWallet, validateMnemonic } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSEllipsisAnimation from '@/components/SSEllipsisAnimation'
import SSFingerprint from '@/components/SSFingerprint'
import SSGradientModal from '@/components/SSGradientModal'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSWordInput from '@/components/SSWordInput'
import { PIN_KEY } from '@/config/auth'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type SeedWordInfo } from '@/types/logic/seedWord'
import { type Account } from '@/types/models/Account'
import { type ImportMnemonicSearchParams } from '@/types/navigation/searchParams'
import { getWordList } from '@/utils/bip39'
import { aesEncrypt } from '@/utils/crypto'
import { seedWordsPrefixOfAnother } from '@/utils/seed'

const MIN_LETTERS_TO_SHOW_WORD_SELECTOR = 2
const wordList = getWordList()

export default function ImportSeed() {
  const { keyIndex } = useLocalSearchParams<ImportMnemonicSearchParams>()
  const router = useRouter()
  const [syncWallet, addAccount, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.syncWallet,
      state.addAccount,
      state.updateAccount
    ])
  )
  const [
    name,
    keys,
    scriptVersion,
    mnemonicWordCount,
    fingerprint,
    derivationPath,
    policyType,
    setParticipant,
    clearAccount,
    getAccount,
    setMnemonic,
    passphrase,
    setPassphrase,
    setFingerprint,
    loadWallet,
    encryptSeed,
    appendKey,
    setKeyCount,
    setKeysRequired,
    getAccountData,
    updateKeyFingerprint,
    setKeyDerivationPath,
    updateKeySecret
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.keys,
      state.scriptVersion,
      state.mnemonicWordCount,
      state.fingerprint,
      state.derivationPath,
      state.policyType,
      state.setParticipant,
      state.clearAccount,
      state.getAccount,
      state.setMnemonic,
      state.passphrase,
      state.setPassphrase,
      state.setFingerprint,
      state.loadWallet,
      state.encryptSeed,
      state.appendKey,
      state.setKeyCount,
      state.setKeysRequired,
      state.getAccountData,
      state.updateKeyFingerprint,
      state.setKeyDerivationPath,
      state.updateKeySecret
    ])
  )
  const addAccountWallet = useWalletsStore((state) => state.addAccountWallet)
  const network = useBlockchainStore((state) => state.network)

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
  const [syncedAccount, setSyncedAccount] = useState<Account>()
  const [walletSyncFailed, setWalletSyncFailed] = useState(false)

  const inputRefs = useRef<TextInput[]>([])
  const passphraseRef = useRef<TextInput>()
  const appState = useRef(AppState.currentState)

  const [keyboardWordSelectorVisible, setKeyboardWordSelectorVisible] =
    useState(false)
  const [accountAddedModalVisible, setAccountAddedModalVisible] =
    useState(false)

  async function checkTextHasSeed(text: string): Promise<string[]> {
    if (text === null || text === '') return []
    const delimiters = [' ', '\n']
    for (const delimiter of delimiters) {
      const seedCandidate = text.split(delimiter)
      if (seedCandidate.length !== mnemonicWordCount) continue
      const validWords = seedCandidate.every((x) => wordList.includes(x))
      if (!validWords) continue
      const checksum = await validateMnemonic(seedCandidate.join(' '))
      if (!checksum) continue
      return seedCandidate
    }
    return []
  }

  async function fillOutSeedWords(seed: string[]) {
    const mnemonic = seed.join(' ')

    setMnemonicWordsInfo(
      seed.map((value, index) => {
        return { value, index, dirty: false, valid: true }
      })
    )

    if (passphraseRef.current) passphraseRef.current.focus()

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
  }

  async function readSeedFromClipboard() {
    const text = (await Clipboard.getStringAsync()).trim()
    const seed = await checkTextHasSeed(text)
    if (seed.length > 0) {
      fillOutSeedWords(seed)
    }
  }

  useEffect(() => {
    readSeedFromClipboard()

    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          setTimeout(async () => {
            await readSeedFromClipboard()
          }, 1) // Refactor: without timeout, getStringAsync returns false
        }
        appState.current = nextAppState
      }
    )

    return () => {
      subscription.remove()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOnChangeTextWord(word: string, index: number) {
    const seedWords = [...mnemonicWordsInfo]
    const seedWord = seedWords[index]

    // We do not allow special chars in text field input
    if (!word.match(/^[a-z]*$/)) {
      seedWord.valid = false
      seedWord.dirty = true

      // We will only open an exception in the edge case the user attempts to
      // paste all seed words at once in the first text field input.
      // This happens if the user switches to another app, copy the seed,
      // switches back to SatSigner, then attempts to paste the seed.
      if (index === 0) {
        const seed = await checkTextHasSeed(word)
        if (seed.length > 0) {
          await fillOutSeedWords(seed)
        }
      }

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

    const mnemonic = mnemonicWordsInfo
      .map((mnemonicWord) => mnemonicWord.value)
      .join(' ')

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

    const checksumValid = await validateMnemonic(mnemonicSeedWords)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setMnemonic(mnemonicSeedWords)
      const fingerprint = await getFingerprint(
        mnemonicSeedWords,
        passphrase,
        network as Network
      )

      setFingerprint(fingerprint)
    }
    focusNextWord(currentWordIndex)
  }

  async function handleUpdatePassphrase(passphrase: string) {
    setPassphrase(passphrase)

    const mnemonic = mnemonicWordsInfo.map((word) => word.value).join(' ')

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
  }

  async function handleOnPressImportSeed() {
    const mnemonic = mnemonicWordsInfo.map((word) => word.value).join(' ')
    setMnemonic(mnemonic)
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

      setAccountAddedModalVisible(true)

      try {
        // const syncedAccount = await syncWallet(wallet, account)
        // setSyncedAccount(syncedAccount)
        // await updateAccount(syncedAccount)
      } catch {
        setWalletSyncFailed(true)
      } finally {
        setLoadingAccount(false)
      }
    } else if (policyType === 'multisig') {
      setParticipant(mnemonic)
      router.back()
    }
  }

  async function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)
    clearAccount()
    router.navigate('/')
  }

  function handleOnPressCancel() {
    if (policyType === 'multisig') {
      router.back()
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
      <SSKeyboardWordSelector
        visible={keyboardWordSelectorVisible}
        wordStart={currentWordText}
        onWordSelected={handleOnWordSelected}
        style={{ height: 60 }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.mnemonic.title')} />
              <SSSeedLayout count={mnemonicWordCount}>
                {[...Array(mnemonicWordsInfo.length)].map((_, index) => (
                  <SSWordInput
                    value={mnemonicWordsInfo[index].value}
                    invalid={
                      !mnemonicWordsInfo[index].valid &&
                      mnemonicWordsInfo[index].dirty
                    }
                    key={index}
                    index={index}
                    ref={(input: TextInput) => inputRefs.current.push(input)}
                    position={index + 1}
                    onSubmitEditing={() => focusNextWord(index)}
                    onChangeText={(text) => handleOnChangeTextWord(text, index)}
                    onEndEditing={(event) =>
                      handleOnEndEditingWord(event.nativeEvent.text, index)
                    }
                    onFocus={(event) =>
                      handleOnFocusWord(event.nativeEvent.text, index)
                    }
                  />
                ))}
              </SSSeedLayout>
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={`${t('bitcoin.passphrase')} (${t('common.optional')})`}
              />
              <SSTextInput
                ref={(input: TextInput) => (passphraseRef.current = input)}
                onChangeText={(text) => handleUpdatePassphrase(text)}
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSHStack justifyBetween>
                <SSChecksumStatus valid={checksumValid} />
                {checksumValid && fingerprint && (
                  <SSFingerprint value={fingerprint} />
                )}
              </SSHStack>
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack>
            <SSButton
              label={t('account.import.title2')}
              variant="secondary"
              loading={loadingAccount}
              disabled={!checksumValid}
              onPress={() => handleOnPressImportSeed()}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={handleOnPressCancel}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
      <SSGradientModal
        visible={accountAddedModalVisible}
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
                {t(`script.${scriptVersion.toLowerCase()}.name`)}
                {'\n'}
                {`(${scriptVersion})`}
              </SSText>
            </SSVStack>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {t('account.fingerprint')}
              </SSText>
              <SSText size="md" color="muted">
                {keys[Number(keyIndex)]?.fingerprint}
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
                {derivationPath}
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
