import { useState } from 'react'

import { type MnemonicWordCount } from '@/types/bips/39'
import { type Notice } from '@/types/ui/notice'

const DEFAULT_WORD_COUNT: MnemonicWordCount = 24

type UseSeedSigningParams = {
  /** Cosigner being signed for, shared with other signing flows (e.g. QR). */
  cosignerIndex: number | null
  setCosignerIndex: (cosignerIndex: number | null) => void
  signWithMnemonic: (cosignerIndex: number, mnemonic: string) => void
  onNotice: (notice: Notice) => void
}

/**
 * Signs for a cosigner by typing seed words: pick the word count, enter the
 * words, then sign with the valid mnemonic.
 */
export function useSeedSigning({
  cosignerIndex,
  setCosignerIndex,
  signWithMnemonic,
  onNotice
}: UseSeedSigningParams) {
  const [seedWordsModalVisible, setSeedWordsModalVisible] = useState(false)
  const [wordCountModalVisible, setWordCountModalVisible] = useState(false)
  const [selectedWordCount, setSelectedWordCount] =
    useState<MnemonicWordCount>(DEFAULT_WORD_COUNT)
  const [currentMnemonic, setCurrentMnemonic] = useState('')

  function startSeedWordsSigning(index: number) {
    setCosignerIndex(index)
    setWordCountModalVisible(true)
  }

  function confirmWordCount() {
    setWordCountModalVisible(false)
    setSeedWordsModalVisible(true)
  }

  function closeWordCountModal() {
    setWordCountModalVisible(false)
    setCosignerIndex(null)
  }

  function handleMnemonicValid(mnemonic: string) {
    setCurrentMnemonic(mnemonic)
  }

  function handleMnemonicInvalid() {
    setCurrentMnemonic('')
  }

  function submitSeedWords() {
    if (!currentMnemonic || cosignerIndex === null) {
      onNotice({ key: 'common.error.validMnemonic', type: 'error' })
      return
    }

    signWithMnemonic(cosignerIndex, currentMnemonic)

    setSeedWordsModalVisible(false)
    setCurrentMnemonic('')
    setCosignerIndex(null)
  }

  function closeSeedWordsModal() {
    setSeedWordsModalVisible(false)
    setCurrentMnemonic('')
    setCosignerIndex(null)
  }

  return {
    closeSeedWordsModal,
    closeWordCountModal,
    confirmWordCount,
    handleMnemonicInvalid,
    handleMnemonicValid,
    seedWordsModalVisible,
    selectedWordCount,
    setSelectedWordCount,
    startSeedWordsSigning,
    submitSeedWords,
    wordCountModalVisible
  }
}
