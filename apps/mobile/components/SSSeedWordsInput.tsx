import { type Network } from 'bdk-rn/lib/lib/enums'
import * as Clipboard from 'expo-clipboard'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { StyleProp, TextInput, ViewStyle } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSFingerprint from '@/components/SSFingerprint'
import SSTextInput from '@/components/SSTextInput'
import SSWordInput from '@/components/SSWordInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type MnemonicWordCount } from '@/types/models/Account'
import { getFingerprintFromSeed } from '@/utils/bip32'
import {
  detectElectrumSeed,
  getFingerprintFromMnemonic,
  getWordList,
  mnemonicToSeedElectrum,
  validateMnemonic,
  type WordListName
} from '@/utils/bip39'
import { type DetectedContent } from '@/utils/contentDetector'

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
  showScanSeedQRButton?: boolean
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
    onWordSelected: (word?: string) => void
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
  wordListName,
  onMnemonicValid,
  onMnemonicInvalid,
  showPassphrase = false,
  showChecksum = true,
  showFingerprint = true,
  showPasteButton = true,
  showScanSeedQRButton = true,
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
  const [electrumSeedType, setElectrumSeedType] = useState<string | null>(null)
  const [fingerprint, setFingerprint] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  const wordList = getWordList(wordListName)
  const passphraseRef = useRef<TextInput>(null)
  const clipboardCheckedRef = useRef(false)
  const wordInputRefs = useRef<(TextInput | null)[]>([])
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const handleWordSelectedRef = useRef<(word?: string) => Promise<void>>()

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

  // Handle word selection from keyboard selector
  const handleWordSelected = useCallback(
    async (word?: string) => {
      if (!word) return
      const newSeedWordsInfo = [...seedWordsInfo]
      const currentWord = newSeedWordsInfo[currentWordIndex]

      currentWord.value = word
      currentWord.dirty = true

      if (wordList.includes(word)) {
        currentWord.valid = true
        setKeyboardWordSelectorVisible(false)
        setCurrentWordText('')
        setSeedWordsInfo(newSeedWordsInfo)

        // Auto-advance to next word if current word is valid
        if (currentWordIndex < wordCount - 1) {
          setCurrentWordIndex(currentWordIndex + 1)
          wordInputRefs.current[currentWordIndex + 1]?.focus()
        }
      } else {
        currentWord.valid = false
        setSeedWordsInfo(newSeedWordsInfo)
      }

      // Validate mnemonic after word selection
      const mnemonic = newSeedWordsInfo.map((info) => info.value).join(' ')
      if (mnemonic.trim().length > 0) {
        const checksumValid = validateMnemonic(mnemonic, wordListName)
        setChecksumValid(checksumValid)
        if (checksumValid) {
          setElectrumSeedType(null)
          const fingerprintResult = getFingerprintFromMnemonic(
            mnemonic,
            passphrase
          )
          setFingerprint(fingerprintResult)
          onMnemonicValid?.(mnemonic, fingerprintResult)
        } else {
          const electrumType = await detectElectrumSeed(mnemonic)
          setElectrumSeedType(electrumType)
          if (electrumType) {
            const seed = await mnemonicToSeedElectrum(mnemonic, passphrase)
            const fingerprintResult = getFingerprintFromSeed(Buffer.from(seed))
            setFingerprint(fingerprintResult)
            onMnemonicValid?.(mnemonic, fingerprintResult)
          } else {
            setFingerprint('')
            onMnemonicInvalid?.()
          }
        }
      }
    },
    [
      seedWordsInfo,
      currentWordIndex,
      wordList,
      wordCount,
      wordListName,
      passphrase,
      onMnemonicValid,
      onMnemonicInvalid
    ]
  )

  // Keep ref updated with latest function
  useEffect(() => {
    handleWordSelectedRef.current = handleWordSelected
  }, [handleWordSelected])

  // Notify parent about word selector state changes
  useEffect(() => {
    onWordSelectorStateChange?.({
      visible: keyboardWordSelectorVisible,
      wordStart: currentWordText,
      onWordSelected: (word?: string) => handleWordSelectedRef.current?.(word)
    })
  }, [keyboardWordSelectorVisible, currentWordText, onWordSelectorStateChange])

  // Check if clipboard contains valid seed (BIP39 or Electrum)
  const checkClipboardForSeed = useCallback(
    (text: string): string[] => {
      if (!text || text === '') return []
      const delimiters = [' ', '\n', ',', ', ']
      for (const delimiter of delimiters) {
        const seedCandidate = text.split(delimiter)
        if (seedCandidate.length !== wordCount) continue
        const validWords = seedCandidate.every((x) => wordList.includes(x))
        if (!validWords) continue
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
      const checksumValid = validateMnemonic(mnemonic, wordListName)
      setChecksumValid(checksumValid)

      if (checksumValid) {
        setElectrumSeedType(null)
        const fingerprintResult = getFingerprintFromMnemonic(
          mnemonic,
          passphrase
        )
        setFingerprint(fingerprintResult)
        onMnemonicValid?.(mnemonic, fingerprintResult)
      } else {
        const electrumType = await detectElectrumSeed(mnemonic)
        setElectrumSeedType(electrumType)
        if (electrumType) {
          const seedBytes = await mnemonicToSeedElectrum(mnemonic, passphrase)
          const fingerprintResult = getFingerprintFromSeed(
            Buffer.from(seedBytes)
          )
          setFingerprint(fingerprintResult)
          onMnemonicValid?.(mnemonic, fingerprintResult)
        } else {
          setFingerprint('')
          onMnemonicInvalid?.()
        }
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

  const handleSeedQRScanned = useCallback(
    (content: DetectedContent) => {
      if (content.type !== 'seed_qr' || !content.metadata?.mnemonic) return
      const mnemonic = content.metadata.mnemonic as string
      const seed = mnemonic.trim().split(/\s+/)
      if (seed.length !== wordCount) {
        toast.error(
          t('account.import.seedQRWordCountMismatch', {
            count: wordCount
          })
        )
        return
      }
      setCameraModalVisible(false)
      fillOutSeedWords(seed)
      toast.success(t('common.success.qrScanned'))
    },
    [wordCount, fillOutSeedWords]
  )

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
      const checksumValid = validateMnemonic(mnemonic, wordListName)
      setChecksumValid(checksumValid)

      if (checksumValid) {
        setElectrumSeedType(null)
        const fingerprintResult = getFingerprintFromMnemonic(
          mnemonic,
          passphrase
        )
        setFingerprint(fingerprintResult)
        onMnemonicValid?.(mnemonic, fingerprintResult)
      } else {
        const electrumType = await detectElectrumSeed(mnemonic)
        setElectrumSeedType(electrumType)
        if (electrumType) {
          const seed = await mnemonicToSeedElectrum(mnemonic, passphrase)
          const fingerprintResult = getFingerprintFromSeed(Buffer.from(seed))
          setFingerprint(fingerprintResult)
          onMnemonicValid?.(mnemonic, fingerprintResult)
        } else {
          setFingerprint('')
          onMnemonicInvalid?.()
        }
      }
    } else {
      setChecksumValid(false)
      setElectrumSeedType(null)
      setFingerprint('')
      onMnemonicInvalid?.()
    }
  }

  const handlePassphraseChange = async (text: string) => {
    setPassphrase(text)

    // Re-validate mnemonic with new passphrase if mnemonic is complete
    const mnemonic = seedWordsInfo.map((info) => info.value).join(' ')
    if (mnemonic.trim().length > 0) {
      if (checksumValid) {
        const fingerprintResult = getFingerprintFromMnemonic(mnemonic, text)
        setFingerprint(fingerprintResult)
        onMnemonicValid?.(mnemonic, fingerprintResult)
      } else if (electrumSeedType) {
        const seed = await mnemonicToSeedElectrum(mnemonic, text)
        const fingerprintResult = getFingerprintFromSeed(Buffer.from(seed))
        setFingerprint(fingerprintResult)
        onMnemonicValid?.(mnemonic, fingerprintResult)
      }
    }
  }

  return (
    <SSVStack gap="lg" style={style}>
      <SSFormLayout>
        <SSFormLayout.Item>
          <SSFormLayout.Label
            label={`${t('account.mnemonic.title')} (${wordListName.replaceAll('_', ' ').toUpperCase()})`}
          />
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
              {showChecksum && (
                <SSChecksumStatus
                  valid={
                    checksumValid ? true : electrumSeedType ? 'electrum' : false
                  }
                />
              )}
              {showFingerprint &&
                (checksumValid || electrumSeedType) &&
                fingerprint && <SSFingerprint value={fingerprint} />}
            </SSHStack>
          </SSFormLayout.Item>
        )}
      </SSFormLayout>
      <SSVStack gap="sm">
        {(showPasteButton || showScanSeedQRButton) && (
          <SSHStack gap="sm" style={{ width: '100%' }}>
            {showPasteButton && (
              <SSButton
                label={t('common.paste')}
                variant="outline"
                onPress={readSeedFromClipboard}
                style={{ flex: 1 }}
              />
            )}
            {showScanSeedQRButton && (
              <SSButton
                label={t('account.import.scanSeedQR')}
                variant="outline"
                onPress={() => setCameraModalVisible(true)}
                style={{ flex: 1 }}
              />
            )}
          </SSHStack>
        )}
        {showActionButton && (
          <SSButton
            label={actionButtonLabel}
            variant={actionButtonVariant}
            disabled={
              actionButtonDisabled || (!checksumValid && !electrumSeedType)
            }
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
      {showScanSeedQRButton && (
        <SSCameraModal
          context="bitcoin"
          visible={cameraModalVisible}
          onClose={() => setCameraModalVisible(false)}
          onContentScanned={handleSeedQRScanned}
        />
      )}
    </SSVStack>
  )
}
