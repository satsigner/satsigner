import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { MNEMONIC_WORD_COUNTS, type MnemonicWordCount } from '@/types/bips/39'

type SSWordCountSelectModalProps = {
  visible: boolean
  onClose: () => void
  selectedWordCount: MnemonicWordCount
  setSelectedWordCount: (count: MnemonicWordCount) => void
  onContinue: () => void
}

// Modal to pick the mnemonic word count (12–24) before entering seed words.
function SSWordCountSelectModal({
  visible,
  onClose,
  selectedWordCount,
  setSelectedWordCount,
  onContinue
}: SSWordCountSelectModalProps) {
  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack gap="lg">
        <SSText center uppercase>
          {t('transaction.preview.selectSeedWordCount')}
        </SSText>
        <SSText center color="muted" size="sm">
          {t('transaction.preview.selectSeedWordCountHint')}
        </SSText>
        <SSVStack gap="sm">
          {MNEMONIC_WORD_COUNTS.map((wordCount) => (
            <WordCountOption
              key={wordCount}
              wordCount={wordCount}
              selected={selectedWordCount === wordCount}
              onSelect={setSelectedWordCount}
            />
          ))}
        </SSVStack>
      </SSVStack>
      <SSHStack gap="sm">
        <SSButton
          label={t('common.continue')}
          variant="secondary"
          onPress={onContinue}
        />
      </SSHStack>
    </SSModal>
  )
}

type WordCountOptionProps = {
  wordCount: MnemonicWordCount
  selected: boolean
  onSelect: (count: MnemonicWordCount) => void
}

function WordCountOption({
  wordCount,
  selected,
  onSelect
}: WordCountOptionProps) {
  function handlePress() {
    onSelect(wordCount)
  }

  return (
    <SSButton
      label={t('transaction.preview.wordsCount', { count: wordCount })}
      variant={selected ? 'outline' : 'ghost'}
      onPress={handlePress}
    />
  )
}

export default SSWordCountSelectModal
