import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'

import { getWordList } from '@/api/bip39'
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
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { Colors } from '@/styles'

type SeedWordInfo = {
  value: string
  index: number
  valid: boolean
  dirty: boolean
}

const MIN_LETTERS_TO_SHOW_WORD_SELECTOR = 2
const wordList = getWordList()

export default function ImportSeed() {
  const router = useRouter()
  const accountStore = useAccountStore()

  const [seedWordsInfo, setSeedWordsInfo] = useState<SeedWordInfo[]>(
    [...Array(accountStore.currentAccount.seedWordCount || 0)].map(
      (_, index) => ({
        value: '',
        index,
        dirty: false,
        valid: false
      })
    )
  )
  const [checksumValid, setChecksumValid] = useState(false)
  const [currentWordText, setCurrentWordText] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [keyboardWordSelectorVisible, setKeyboardWordSelectorVisible] =
    useState(false)

  const [accountAddedModalVisible, setAccountAddedModalVisible] =
    useState(false)

  const [loadingAccount, setLoadingAccount] = useState(false)

  async function handleOnChangeTextWord(word: string, index: number) {
    const seedWords = seedWordsInfo.map((seedWordInfo) => seedWordInfo)
    const seedWord = seedWords[index]

    seedWord.value = word

    if (wordList.includes(word)) seedWord.valid = true
    else
      setKeyboardWordSelectorVisible(
        word.length >= MIN_LETTERS_TO_SHOW_WORD_SELECTOR
      )

    setCurrentWordText(word)
    setSeedWordsInfo(seedWords)

    const mnemonicSeedWords = seedWords.map((seedWord) => seedWord.value)
    const checksumValid = await accountStore.validateMnemonic(mnemonicSeedWords)

    if (checksumValid)
      await accountStore.updateFingerprint(
        mnemonicSeedWords,
        accountStore.currentAccount.passphrase
      )

    setChecksumValid(checksumValid)
  }

  function handleOnEndEditingWord(word: string, index: number) {
    const seedWords = seedWordsInfo.map((seedWordInfo) => seedWordInfo)
    const seedWord = seedWords[index]

    seedWord.value = word
    seedWord.valid = wordList.includes(word)
    seedWord.dirty ||= word.length > 0

    setSeedWordsInfo(seedWords)
    setCurrentWordText(word)
  }

  function handleOnFocusWord(word: string | undefined, index: number) {
    const seedWords = seedWordsInfo.map((seedWordInfo) => seedWordInfo)
    const seedWord = seedWords[index]

    setCurrentWordText(word || '')
    setCurrentWordIndex(index)
    setKeyboardWordSelectorVisible(
      !seedWord.valid &&
        (word?.length || 0) >= MIN_LETTERS_TO_SHOW_WORD_SELECTOR
    )
  }

  async function handleOnWordSelected(word: string) {
    const seedWords = seedWordsInfo.map((seedWordInfo) => seedWordInfo)
    seedWords[currentWordIndex].value = word

    if (wordList.includes(word)) {
      seedWords[currentWordIndex].valid = true
      setKeyboardWordSelectorVisible(false)
    }

    setSeedWordsInfo(seedWords)

    const mnemonicSeedWords = seedWords.map((seedWord) => seedWord.value)
    const checksumValid = await accountStore.validateMnemonic(mnemonicSeedWords)

    if (checksumValid)
      await accountStore.updateFingerprint(
        mnemonicSeedWords,
        accountStore.currentAccount.passphrase
      )

    setChecksumValid(checksumValid)
  }

  async function handleUpdatePassphrase(passphrase: string) {
    accountStore.currentAccount.passphrase = passphrase
    const mnemonicSeedWords = seedWordsInfo.map((seedWord) => seedWord.value)

    const checksumValid = await accountStore.validateMnemonic(mnemonicSeedWords)

    if (checksumValid)
      await accountStore.updateFingerprint(mnemonicSeedWords, passphrase)

    setChecksumValid(checksumValid)
  }

  async function handleOnPressImportSeed() {
    if (!accountStore.currentAccount.scriptVersion) return

    accountStore.currentAccount.seedWords = seedWordsInfo.map(
      (seedWord) => seedWord.value
    )

    const wallet = await accountStore.loadWalletFromMnemonic(
      accountStore.currentAccount.seedWords,
      accountStore.currentAccount.scriptVersion,
      accountStore.currentAccount.passphrase
    )

    setLoadingAccount(true)
    setAccountAddedModalVisible(true)

    await accountStore.syncWallet(wallet)
    const account = await accountStore.getPopulatedAccount(
      wallet,
      accountStore.currentAccount
    )

    setLoadingAccount(false)
    await accountStore.saveAccount(account)
  }

  async function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)
    router.replace('/accountList/')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
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
              <SSFormLayout.Label
                label={i18n.t('addMasterKey.accountOptions.mnemonic')}
              />
              {accountStore.currentAccount.seedWordCount && (
                <SSSeedLayout count={accountStore.currentAccount.seedWordCount}>
                  {[...Array(seedWordsInfo.length)].map((_, index) => (
                    <SSWordInput
                      value={seedWordsInfo[index].value}
                      invalid={
                        !seedWordsInfo[index].valid &&
                        seedWordsInfo[index].dirty
                      }
                      key={index}
                      position={index + 1}
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
                label={`${i18n.t('bitcoin.passphrase')} (${i18n.t('common.optional')})`}
              />
              <SSTextInput
                onChangeText={(text) => handleUpdatePassphrase(text)}
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSHStack justifyBetween>
                <SSChecksumStatus valid={checksumValid} />
                {accountStore.currentAccount.fingerprint && (
                  <SSFingerprint
                    value={accountStore.currentAccount.fingerprint}
                  />
                )}
              </SSHStack>
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack>
            <SSButton
              label={i18n.t('addMasterKey.importExistingSeed.action')}
              variant="secondary"
              disabled={!checksumValid}
              onPress={() => handleOnPressImportSeed()}
            />
            <SSButton
              label={i18n.t('common.cancel')}
              variant="ghost"
              onPress={() => router.replace('/accountList/')}
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
              {accountStore.currentAccount.name}
            </SSText>
            <SSText color="muted" size="lg">
              {i18n.t('addMasterKey.importExistingSeed.accountAdded')}
            </SSText>
          </SSVStack>
          <SSSeparator />
          <SSHStack justifyEvenly style={{ alignItems: 'flex-start' }}>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {i18n.t('bitcoin.script')}
              </SSText>
              <SSText size="md" color="muted" center>
                {i18n.t(
                  `addMasterKey.accountOptions.scriptVersions.names.${accountStore.currentAccount.scriptVersion?.toLowerCase()}`
                )}
                {'\n'}
                {`(${accountStore.currentAccount.scriptVersion})`}
              </SSText>
            </SSVStack>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {i18n.t('bitcoin.fingerprint')}
              </SSText>
              <SSText size="md" color="muted">
                {accountStore.currentAccount.fingerprint}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSSeparator />
          <SSVStack>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {i18n.t(
                  'addMasterKey.importExistingSeed.accountAddedModal.derivationPath'
                )}
              </SSText>
              {loadingAccount ? (
                <SSEllipsisAnimation />
              ) : (
                <SSText size="md" color="muted">
                  {accountStore.currentAccount.derivationPath}
                </SSText>
              )}
            </SSVStack>
            <SSHStack justifyEvenly>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {i18n.t(
                    'addMasterKey.importExistingSeed.accountAddedModal.utxos'
                  )}
                </SSText>
                {loadingAccount ? (
                  <SSEllipsisAnimation />
                ) : (
                  <SSText size="md" color="muted">
                    {accountStore.currentAccount.summary.numberOfUtxos}
                  </SSText>
                )}
              </SSVStack>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {i18n.t(
                    'addMasterKey.importExistingSeed.accountAddedModal.sats'
                  )}
                </SSText>
                {loadingAccount ? (
                  <SSEllipsisAnimation />
                ) : (
                  <SSText size="md" color="muted">
                    {accountStore.currentAccount.summary.balance}
                  </SSText>
                )}
              </SSVStack>
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSGradientModal>
    </SSMainLayout>
  )
}
