import { useState } from 'react'

import { LONG_MNEMONIC_WORD_COUNT } from '@/constants/bip39'
import { type MnemonicWordCount } from '@/types/bips/39'
import { type Notice } from '@/types/ui/notice'

type UseSeedWordsSigningParams = {
  selectedCosignerIndex: number | null
  setSelectedCosignerIndex: (cosignerIndex: number | null) => void
  signWithMnemonic: (cosignerIndex: number, mnemonic: string) => void
  onNotice: (notice: Notice) => void
}

export function useSeedWordsSigning({
  selectedCosignerIndex,
  setSelectedCosignerIndex,
  signWithMnemonic,
  onNotice
}: UseSeedWordsSigningParams) {
  const [seedWordsModalVisible, setSeedWordsModalVisible] = useState(false)
  const [wordCountModalVisible, setWordCountModalVisible] = useState(false)
  const [selectedWordCount, setSelectedWordCount] = useState<MnemonicWordCount>(
    LONG_MNEMONIC_WORD_COUNT
  )
  const [currentMnemonic, setCurrentMnemonic] = useState('')

  function startSeedWordsSigning(index: number) {
    setSelectedCosignerIndex(index)
    setWordCountModalVisible(true)
  }

  function confirmWordCount() {
    setWordCountModalVisible(false)
    setSeedWordsModalVisible(true)
  }

  function closeWordCountModal() {
    setWordCountModalVisible(false)
    setSelectedCosignerIndex(null)
  }

  function handleMnemonicValid(mnemonic: string) {
    setCurrentMnemonic(mnemonic)
  }

  function handleMnemonicInvalid() {
    setCurrentMnemonic('')
  }

  function submitSeedWords() {
    if (!currentMnemonic || selectedCosignerIndex === null) {
      onNotice({ key: 'common.error.validMnemonic', type: 'error' })
      return
    }

    signWithMnemonic(selectedCosignerIndex, currentMnemonic)

    setSeedWordsModalVisible(false)
    setCurrentMnemonic('')
    setSelectedCosignerIndex(null)
  }

  function closeSeedWordsModal() {
    setSeedWordsModalVisible(false)
    setCurrentMnemonic('')
    setSelectedCosignerIndex(null)
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
