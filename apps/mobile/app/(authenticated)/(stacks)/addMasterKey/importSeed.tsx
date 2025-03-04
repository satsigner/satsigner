import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { AppState, ScrollView, type TextInput } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { validateMnemonic } from '@/api/bdk'
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
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type SeedWordInfo } from '@/types/logic/seedWord'
import { type Account } from '@/types/models/Account'
import { getWordList } from '@/utils/bip39'
import { seedWordsPrefixOfAnother } from '@/utils/seed'

const MIN_LETTERS_TO_SHOW_WORD_SELECTOR = 2
const wordList = getWordList()

export default function ImportSeed() {
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
    scriptVersion,
    seedWordCount,
    fingerprint,
    derivationPath,
    policyType,
    setParticipant,
    clearAccount,
    getAccount,
    setSeedWords,
    setPassphrase,
    updateFingerprint,
    loadWallet,
    encryptSeed
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.scriptVersion,
      state.seedWordCount,
      state.fingerprint,
      state.derivationPath,
      state.policyType,
      state.setParticipant,
      state.clearAccount,
      state.getAccount,
      state.setSeedWords,
      state.setPassphrase,
      state.updateFingerprint,
      state.loadWallet,
      state.encryptSeed
    ])
  )

  const [seedWordsInfo, setSeedWordsInfo] = useState<SeedWordInfo[]>(
    [...Array(seedWordCount)].map((_, index) => ({
      value: '',
      index,
      dirty: false,
      valid: false
    }))
  )
  const [checksumValid, setChecksumValid] = useState(false)
  const [currentWordText, setCurrentWordText] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [keyboardWordSelectorVisible, setKeyboardWordSelectorVisible] =
    useState(false)
  const [accountAddedModalVisible, setAccountAddedModalVisible] =
    useState(false)
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [syncedAccount, setSyncedAccount] = useState<Account>()
  const [walletSyncFailed, setWalletSyncFailed] = useState(false)
  const inputRefs = useRef<TextInput[]>([])
  const passphraseRef = useRef<TextInput>()
  const appState = useRef(AppState.currentState)

  async function checkTextHasSeed(text: string): Promise<string[]> {
    if (text === null || text === '') return []
    const delimiters = [' ', '\n']
    for (const delimiter of delimiters) {
      const seedCandidate = text.split(delimiter)
      if (seedCandidate.length !== seedWordCount) continue
      const validWords = seedCandidate.every((x) => wordList.includes(x))
      if (!validWords) continue
      const checksum = await validateMnemonic(seedCandidate.join(' '))
      if (!checksum) continue
      return seedCandidate
    }
    return []
  }

  async function fillOutSeedWords(seed: string[]) {
    setSeedWords(seed.join(' '))
    setSeedWordsInfo(
      seed.map((value, index) => {
        return { value, index, dirty: false, valid: true }
      })
    )
    setChecksumValid(true)
    if (passphraseRef.current) passphraseRef.current.focus()
    await updateFingerprint()
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
    const seedWords = [...seedWordsInfo]
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
    setSeedWordsInfo(seedWords)

    const mnemonicSeedWords = seedWordsInfo
      .map((seedWord) => seedWord.value)
      .join(' ')

    const checksumValid = await validateMnemonic(mnemonicSeedWords)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setSeedWords(mnemonicSeedWords)
      await updateFingerprint()
    }

    if (seedWord.valid && !seedWordsPrefixOfAnother[word]) {
      focusNextWord(index)
    }
  }

  function focusNextWord(currentIndex: number) {
    const nextIndex = currentIndex + 1
    if (nextIndex < seedWordCount) {
      inputRefs.current[nextIndex]?.focus()
    } else if (passphraseRef.current) {
      passphraseRef.current.focus()
    }
  }

  function handleOnEndEditingWord(word: string, index: number) {
    const seedWords = [...seedWordsInfo]
    const seedWord = seedWords[index]

    seedWord.value = word
    seedWord.valid = wordList.includes(word)
    seedWord.dirty ||= word.length > 0

    setSeedWordsInfo(seedWords)
    setCurrentWordText(word)
  }

  function handleOnFocusWord(word: string | undefined, index: number) {
    const seedWords = [...seedWordsInfo]
    const seedWord = seedWords[index]

    setCurrentWordText(word || '')
    setCurrentWordIndex(index)
    setKeyboardWordSelectorVisible(
      !seedWord.valid &&
        (word?.length || 0) >= MIN_LETTERS_TO_SHOW_WORD_SELECTOR
    )
  }

  async function handleOnWordSelected(word: string) {
    const seedWords = [...seedWordsInfo]
    seedWords[currentWordIndex].value = word

    if (wordList.includes(word)) {
      seedWords[currentWordIndex].valid = true
      setKeyboardWordSelectorVisible(false)
    }

    setSeedWordsInfo(seedWords)

    const mnemonicSeedWords = seedWords
      .map((seedWord) => seedWord.value)
      .join(' ')

    const checksumValid = await validateMnemonic(mnemonicSeedWords)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setSeedWords(mnemonicSeedWords)
      await updateFingerprint()
    }
    focusNextWord(currentWordIndex)
  }

  async function handleUpdatePassphrase(passphrase: string) {
    setPassphrase(passphrase)

    const mnemonicSeedWords = seedWordsInfo
      .map((seedWord) => seedWord.value)
      .join(' ')

    const checksumValid = await validateMnemonic(mnemonicSeedWords)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      setSeedWords(mnemonicSeedWords)
      await updateFingerprint()
    }
  }

  async function handleOnPressImportSeed() {
    const seedWords = seedWordsInfo.map((seedWord) => seedWord.value).join(' ')
    setSeedWords(seedWords)

    if (policyType === 'single') {
      setLoadingAccount(true)

      const wallet = await loadWallet()
      await encryptSeed()

      setAccountAddedModalVisible(true)

      const account = getAccount()
      await addAccount(account)

      try {
        const syncedAccount = await syncWallet(wallet, account)
        setSyncedAccount(syncedAccount)
        await updateAccount(syncedAccount)
      } catch {
        setWalletSyncFailed(true)
      } finally {
        setLoadingAccount(false)
      }
    } else if (policyType === 'multi') {
      setParticipant(seedWords)
      router.back()
    }
  }

  async function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)
    clearAccount()
    router.navigate('/')
  }

  function handleOnPressCancel() {
    if (policyType === 'multi') {
      router.back()
    } else if (policyType === 'single') {
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
              {seedWordCount && (
                <SSSeedLayout count={seedWordCount}>
                  {[...Array(seedWordsInfo.length)].map((_, index) => (
                    <SSWordInput
                      value={seedWordsInfo[index].value}
                      invalid={
                        !seedWordsInfo[index].valid &&
                        seedWordsInfo[index].dirty
                      }
                      key={index}
                      index={index}
                      ref={(input: TextInput) => inputRefs.current.push(input)}
                      position={index + 1}
                      onSubmitEditing={() => focusNextWord(index)}
                      onChangeText={(text) =>
                        handleOnChangeTextWord(text, index)
                      }
                      onEndEditing={(event) =>
                        handleOnEndEditingWord(event.nativeEvent.text, index)
                      }
                      onFocus={(event) =>
                        handleOnFocusWord(event.nativeEvent.text, index)
                      }
                    />
                  ))}
                </SSSeedLayout>
              )}
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
