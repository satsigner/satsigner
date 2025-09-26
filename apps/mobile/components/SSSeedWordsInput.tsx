import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type StyleProp, type ViewStyle, TextInput } from 'react-native'
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
  validateMnemonic
} from '@/utils/bip39'

type SeedWordInfo = {
  value: string
  valid: boolean
  dirty: boolean
}

type SSSeedWordsInputProps = {
  wordCount: MnemonicWordCount
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
  onWordSelectorStateChange?: (state: {
    visible: boolean
    wordStart: string
    onWordSelected: (word: string) => void
  }) => void
}

const MIN_LETTERS_TO_SHOW_WORD_SELECTOR = 2
const PREFIX_WORD_DELAY_MS = 1500 // 1.5 seconds delay for prefix words

// Check if a word is a prefix of other words in the BIP39 word list
function isPrefixWord(word: string, wordList: string[]): boolean {
  return wordList.some((w) => w.startsWith(word) && w !== word)
}

export default function SSSeedWordsInput({
  wordCount,
  network,
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
  style,
  onWordSelectorStateChange
}: SSSeedWordsInputProps) {
  const [seedWordsInfo, setSeedWordsInfo] = useState<SeedWordInfo[]>([])
  const [keyboardWordSelectorVisible, setKeyboardWordSelectorVisible] =
    useState(false)
  const [currentWordText, setCurrentWordText] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [checksumValid, setChecksumValid] = useState(false)
  const [fingerprint, setFingerprint] = useState('')
  const [passphrase, setPassphrase] = useState('')

  const wordList = getWordList()
  const passphraseRef = useRef<TextInput>(null)
  const clipboardCheckedRef = useRef(false)
  const wordInputRefs = useRef<(TextInput | null)[]>([])
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    // Initialize refs array
    wordInputRefs.current = Array(wordCount).fill(null)
  }, [wordCount])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
      }
    }
  }, [])

  // Notify parent about word selector state changes
  useEffect(() => {
    onWordSelectorStateChange?.({
      visible: keyboardWordSelectorVisible,
      wordStart: currentWordText,
      onWordSelected: handleWordSelected
    })
  }, [keyboardWordSelectorVisible, currentWordText, onWordSelectorStateChange])

  // Check if clipboard contains valid seed
  const checkClipboardForSeed = useCallback(
    async (text: string): Promise<string[]> => {
      if (!text || text === '') return []
      const delimiters = [' ', '\n', ',', ', ']
      for (const delimiter of delimiters) {
        const seedCandidate = text.split(delimiter)
        if (seedCandidate.length !== wordCount) continue
        const validWords = seedCandidate.every((x) => wordList.includes(x))
        if (!validWords) continue
        const checksum = validateMnemonic(seedCandidate.join(' '))
        if (!checksum) continue
        return seedCandidate
      }
      return []
    },
    [wordCount, wordList]
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
      const checksumValid = validateMnemonic(mnemonic)
      setChecksumValid(checksumValid)

      if (checksumValid) {
        const fingerprintResult = getFingerprintFromMnemonic(
          mnemonic,
          passphrase,
          network
        )
        setFingerprint(fingerprintResult)
        onMnemonicValid?.(mnemonic, fingerprintResult)
      } else {
        onMnemonicInvalid?.()
      }
    },
    [passphrase, network, onMnemonicValid, onMnemonicInvalid]
  )

  const readSeedFromClipboard = useCallback(async () => {
    try {
      const text = (await Clipboard.getStringAsync()).trim()
      const seed = await checkClipboardForSeed(text)
      if (seed.length > 0) {
        await fillOutSeedWords(seed)
        toast.success('Seed words pasted from clipboard')
      } else {
        toast.error('No valid seed found in clipboard')
      }
    } catch (_error) {
      toast.error('Failed to read clipboard')
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

      // Clear auto-advance timeout if invalid characters are entered
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
        autoAdvanceTimeoutRef.current = null
      }
      return
    }

    seedWord.value = value.trim()
    seedWord.dirty = true // Mark as dirty when user starts typing
    setCurrentWordText(value.trim())
    setCurrentWordIndex(index)

    // Check if word is in BIP39 word list
    const trimmedValue = value.trim()
    if (wordList.includes(trimmedValue)) {
      seedWord.valid = true
      setKeyboardWordSelectorVisible(false)

      // Clear any existing timeout
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
      }

      // Auto-advance to next input when word is valid
      if (index < wordCount - 1) {
        const isPrefix = isPrefixWord(trimmedValue, wordList)
        const delay = isPrefix ? PREFIX_WORD_DELAY_MS : 100

        autoAdvanceTimeoutRef.current = setTimeout(() => {
          wordInputRefs.current[index + 1]?.focus()
        }, delay)
      }
    } else {
      seedWord.valid = false
      const shouldShow =
        trimmedValue.length >= MIN_LETTERS_TO_SHOW_WORD_SELECTOR
      setKeyboardWordSelectorVisible(shouldShow)

      // Clear auto-advance timeout if current word becomes invalid
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
        autoAdvanceTimeoutRef.current = null
      }
    }

    setSeedWordsInfo(newSeedWordsInfo)

    // Validate complete mnemonic
    const mnemonic = newSeedWordsInfo.map((info) => info.value).join(' ')
    if (mnemonic.trim().length > 0) {
      const checksumValid = validateMnemonic(mnemonic)
      setChecksumValid(checksumValid)

      if (checksumValid) {
        const fingerprintResult = getFingerprintFromMnemonic(
          mnemonic,
          passphrase,
          network
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
    const currentWord = newSeedWordsInfo[currentWordIndex]

    currentWord.value = word
    currentWord.dirty = true

    if (wordList.includes(word)) {
      currentWord.valid = true
      setKeyboardWordSelectorVisible(false)

      // Clear any existing timeout
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current)
      }

      // Auto-advance to next input when word is selected
      if (currentWordIndex < wordCount - 1) {
        const isPrefix = isPrefixWord(word, wordList)
        const delay = isPrefix ? PREFIX_WORD_DELAY_MS : 100

        autoAdvanceTimeoutRef.current = setTimeout(() => {
          wordInputRefs.current[currentWordIndex + 1]?.focus()
        }, delay)
      }
    }

    setSeedWordsInfo(newSeedWordsInfo)

    // Validate complete mnemonic
    const mnemonic = newSeedWordsInfo.map((info) => info.value).join(' ')
    const checksumValid = validateMnemonic(mnemonic)
    setChecksumValid(checksumValid)

    if (checksumValid) {
      const fingerprintResult = getFingerprintFromMnemonic(
        mnemonic,
        passphrase,
        network
      )
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
      const fingerprintResult = getFingerprintFromMnemonic(
        mnemonic,
        text,
        network
      )
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
                ref={(ref) => {
                  wordInputRefs.current[index] = ref
                }}
                value={wordInfo.value}
                position={index + 1}
                index={index}
                invalid={!wordInfo.valid && wordInfo.dirty}
                onChangeText={(text) => handleSeedWordChange(index, text)}
                onSubmitEditing={() => {
                  if (index < wordCount - 1) {
                    wordInputRefs.current[index + 1]?.focus()
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
