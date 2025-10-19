import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSFingerprint from '@/components/SSFingerprint'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSTextInput from '@/components/SSTextInput'
import SSWordInput from '@/components/SSWordInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type MnemonicWordCount } from '@/types/models/Account'
import {
  getFingerprintFromMnemonic,
  getWordList,
  validateMnemonic,
  type WordListName
} from '@/utils/bip39'

type SeedWordInfo = {
  value: string
  valid: boolean
  dirty: boolean
}

type SSSeedWordsInputProps = {
  wordCount: MnemonicWordCount
  wordListName: WordListName
  network: Network
  onMnemonicValid?: (mnemonic: string, fingerprint: string) => void
  onMnemonicInvalid?: () => void
  showPassphrase?: boolean
  showChecksum?: boolean
  showFingerprint?: boolean
  showPasteButton?: boolean
  showActionButton?: boolean
  actionButtonLabel?: string
  actionButtonVariant?:
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'default'
    | 'subtle'
    | 'gradient'
    | 'danger'
  onActionButtonPress?: () => void
  actionButtonDisabled?: boolean
  actionButtonLoading?: boolean
  cancelButtonLabel?: string
  onCancelButtonPress?: () => void
  showCancelButton?: boolean
  autoCheckClipboard?: boolean
  style?: StyleProp<ViewStyle>
}

const MIN_LETTERS_TO_SHOW_WORD_SELECTOR = 2

export default function SSSeedWordsInput({
  wordCount,
  wordListName,
  onMnemonicValid,
  onMnemonicInvalid,
  showPassphrase = false,
  showChecksum = true,
  showFingerprint = true,
  showPasteButton = true,
  showActionButton = true,
  actionButtonLabel = 'Continue',
  actionButtonVariant = 'secondary',
  onActionButtonPress,
  actionButtonDisabled = false,
  actionButtonLoading = false,
  cancelButtonLabel = 'Cancel',
  onCancelButtonPress,
  showCancelButton = true,
  autoCheckClipboard = true,
  style
}: SSSeedWordsInputProps) {
  const [seedWordsInfo, setSeedWordsInfo] = useState<SeedWordInfo[]>([])
  const [keyboardWordSelectorVisible, setKeyboardWordSelectorVisible] =
    useState(false)
  const [currentWordText, setCurrentWordText] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [checksumValid, setChecksumValid] = useState(false)
  const [fingerprint, setFingerprint] = useState('')
  const [passphrase, setPassphrase] = useState('')

  const passphraseRef = useRef<any>()
  const clipboardCheckedRef = useRef(false)
  const wordList = getWordList(wordListName)

  // Initialize seed words info
  useEffect(() => {
    const initialSeedWordsInfo = Array(wordCount)
      .fill(null)
      .map(() => ({
        value: '',
        valid: false,
        dirty: false
      }))
    setSeedWordsInfo(initialSeedWordsInfo)
  }, [wordCount])

  // Check if clipboard contains valid seed
  const checkClipboardForSeed = useCallback(
    (text: string): string[] => {
      if (!text || text === '') return []
      const delimiters = [' ', '\n', ',', ', ']
      for (const delimiter of delimiters) {
        const seedCandidate = text.split(delimiter)
        if (seedCandidate.length !== wordCount) continue
        const validWords = seedCandidate.every((x) => wordList.includes(x))
        if (!validWords) continue
        const validMnemonic = validateMnemonic(
          seedCandidate.join(' '),
          wordListName
        )
        if (!validMnemonic) continue
        return seedCandidate
      }
      return []
    },
    [wordCount, wordList, wordListName]
  )

  // Fill out seed words from clipboard
  const fillOutSeedWords = useCallback(
    async (seed: string[]) => {
      const newSeedWordsInfo = seed.map((value) => ({
        value,
        valid: true,
        dirty: false
      }))

      setSeedWordsInfo(newSeedWordsInfo)

      const mnemonic = seed.join(' ')
      const checksumValid = validateMnemonic(mnemonic, wordListName)
      setChecksumValid(checksumValid)

      if (checksumValid) {
        const fingerprintResult = getFingerprintFromMnemonic(
          mnemonic,
          passphrase
        )
        setFingerprint(fingerprintResult)
        onMnemonicValid?.(mnemonic, fingerprintResult)
      } else {
        onMnemonicInvalid?.()
      }
    },
    [passphrase, onMnemonicValid, onMnemonicInvalid, wordListName]
  )

  const readSeedFromClipboard = useCallback(async () => {
    try {
      const text = (await Clipboard.getStringAsync()).trim()
      const seed = checkClipboardForSeed(text)
      if (seed.length > 0) {
        await fillOutSeedWords(seed)
        toast.success('Seed words pasted from clipboard')
      } else {
        toast.error('No valid seed found in clipboard')
      }
    } catch (error) {
      toast.error(`Failed to read clipboard, ${(error as Error).message}`)
    }
  }, [checkClipboardForSeed, fillOutSeedWords])

  useEffect(() => {
    if (autoCheckClipboard && !clipboardCheckedRef.current) {
      clipboardCheckedRef.current = true
      readSeedFromClipboard()
    }
  }, [autoCheckClipboard]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle seed word input change
  const handleSeedWordChange = async (index: number, value: string) => {
    const newSeedWordsInfo = [...seedWordsInfo]
    const seedWord = newSeedWordsInfo[index]

    // Check for invalid characters
    if (!value.match(/^[a-z]*$/)) {
      seedWord.valid = false
      seedWord.dirty = true
      setSeedWordsInfo(newSeedWordsInfo)
      return
    }

    seedWord.value = value.trim()
    setCurrentWordText(value)
    setCurrentWordIndex(index)

    // Check if word is in BIP39 word list
    if (wordList.includes(value)) {
      seedWord.valid = true
      setKeyboardWordSelectorVisible(false)
    } else {
      seedWord.valid = false
      setKeyboardWordSelectorVisible(
        value.length >= MIN_LETTERS_TO_SHOW_WORD_SELECTOR
      )
    }

    setSeedWordsInfo(newSeedWordsInfo)

    // Validate complete mnemonic
    const mnemonic = newSeedWordsInfo.map((info) => info.value).join(' ')
    if (mnemonic.trim().length > 0) {
      const checksumValid = validateMnemonic(mnemonic, wordListName)
      setChecksumValid(checksumValid)

      if (checksumValid) {
        const fingerprintResult = getFingerprintFromMnemonic(
          mnemonic,
          passphrase
        )
        setFingerprint(fingerprintResult)
        onMnemonicValid?.(mnemonic, fingerprintResult)
      } else {
        onMnemonicInvalid?.()
      }
    } else {
      setChecksumValid(false)
      setFingerprint('')
      onMnemonicInvalid?.()
    }
  }

  // Handle word selection from keyboard selector
  const handleWordSelected = async (word: string) => {
    const newSeedWordsInfo = [...seedWordsInfo]
    newSeedWordsInfo[currentWordIndex].value = word

    if (wordList.includes(word)) {
      newSeedWordsInfo[currentWordIndex].valid = true
      setKeyboardWordSelectorVisible(false)
    }

    setSeedWordsInfo(newSeedWordsInfo)

    const mnemonic = newSeedWordsInfo.map((info) => info.value).join(' ')
    const checksumValid = validateMnemonic(mnemonic, wordListName)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      const fingerprintResult = getFingerprintFromMnemonic(mnemonic, passphrase)
      setFingerprint(fingerprintResult)
      onMnemonicValid?.(mnemonic, fingerprintResult)
    } else {
      onMnemonicInvalid?.()
    }
  }

  const handlePassphraseChange = async (text: string) => {
    setPassphrase(text)

    // Re-validate mnemonic with new passphrase if mnemonic is complete
    const mnemonic = seedWordsInfo.map((info) => info.value).join(' ')
    if (mnemonic.trim().length > 0 && checksumValid) {
      const fingerprintResult = getFingerprintFromMnemonic(mnemonic, text)
      setFingerprint(fingerprintResult)
      onMnemonicValid?.(mnemonic, fingerprintResult)
    }
  }

  return (
    <SSVStack gap="lg" style={style}>
      <SSFormLayout>
        <SSFormLayout.Item>
          <SSFormLayout.Label label={t('account.mnemonic.title')} />
          <SSSeedLayout count={wordCount}>
            {seedWordsInfo.map((wordInfo, index) => (
              <SSWordInput
                key={index}
                value={wordInfo.value}
                position={index + 1}
                index={index}
                invalid={!wordInfo.valid && wordInfo.dirty}
                onChangeText={(text) => handleSeedWordChange(index, text)}
                onSubmitEditing={() => {
                  if (index < wordCount - 1) {
                    // Focus next input (this would need refs to implement properly)
                    // TODO: implement focus next input when word is valid
                  }
                }}
              />
            ))}
          </SSSeedLayout>
        </SSFormLayout.Item>
        {showPassphrase && (
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={`${t('bitcoin.passphrase')} (${t('common.optional')})`}
            />
            <SSTextInput
              ref={passphraseRef}
              onChangeText={handlePassphraseChange}
              value={passphrase}
            />
          </SSFormLayout.Item>
        )}
        {(showChecksum || showFingerprint) && (
          <SSFormLayout.Item>
            <SSHStack gap="sm" justifyBetween>
              {showChecksum && <SSChecksumStatus valid={checksumValid} />}
              {showFingerprint && checksumValid && fingerprint && (
                <SSFingerprint value={fingerprint} />
              )}
            </SSHStack>
          </SSFormLayout.Item>
        )}
      </SSFormLayout>
      <SSKeyboardWordSelector
        visible={keyboardWordSelectorVisible}
        wordStart={currentWordText}
        wordListName={wordListName}
        onWordSelected={handleWordSelected}
        style={{ height: 60 }}
      />
      <SSVStack gap="sm">
        {showPasteButton && (
          <SSButton
            label="Paste from Clipboard"
            variant="outline"
            onPress={readSeedFromClipboard}
          />
        )}
        {showActionButton && (
          <SSButton
            label={actionButtonLabel}
            variant={actionButtonVariant}
            disabled={actionButtonDisabled || !checksumValid}
            loading={actionButtonLoading}
            onPress={onActionButtonPress}
          />
        )}
        {showCancelButton && (
          <SSButton
            label={cancelButtonLabel}
            variant="ghost"
            onPress={onCancelButtonPress}
          />
        )}
      </SSVStack>
    </SSVStack>
  )
}
