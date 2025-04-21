import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, ScrollView, type TextInput } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  getExtendedPublicKeyFromAccountKey,
  getFingerprint,
  validateMnemonic
} from '@/api/bdk'
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
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type SeedWordInfo } from '@/types/logic/seedWord'
import { type Account } from '@/types/models/Account'
import { type ImportMnemonicSearchParams } from '@/types/navigation/searchParams'
import { getWordList } from '@/utils/bip39'
import { seedWordsPrefixOfAnother } from '@/utils/seed'

const MIN_LETTERS_TO_SHOW_WORD_SELECTOR = 2
const wordList = getWordList()

export default function ImportMnemonic() {
  const { keyIndex } = useLocalSearchParams<ImportMnemonicSearchParams>()
  const router = useRouter()
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const [
    name,
    keys,
    scriptVersion,
    mnemonicWordCount,
    fingerprint,
    policyType,
    clearAccount,
    setMnemonic,
    passphrase,
    setPassphrase,
    setFingerprint,
    setKey,
    getAccountData,
    updateKeySecret,
    clearKeyState
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.keys,
      state.scriptVersion,
      state.mnemonicWordCount,
      state.fingerprint,
      state.policyType,
      state.clearAccount,
      state.setMnemonic,
      state.passphrase,
      state.setPassphrase,
      state.setFingerprint,
      state.setKey,
      state.getAccountData,
      state.updateKeySecret,
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

    if (!word.match(/^[a-z]*$/)) {
      seedWord.valid = false
      seedWord.dirty = true

      // Paste all seed words at once
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
    setLoadingAccount(true)

    const mnemonic = mnemonicWordsInfo.map((word) => word.value).join(' ')
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
      updateKeySecret(Number(keyIndex), {
        ...(currentKey.secret as object),
        extendedPublicKey
      })

      setLoadingAccount(false)
      clearKeyState()
      router.dismiss(2)
    }
  }

  async function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)
    clearKeyState()
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
              disabled={!checksumValid || accountImported}
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
                {syncedAccount?.keys[Number(keyIndex)].derivationPath}
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
