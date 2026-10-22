import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import { t } from '@/locales'
import { MNEMONIC_WORD_COUNTS, type MnemonicWordCount } from '@/types/bips/39'
import { setStateWithLayoutAnimation } from '@/utils/animation'

type SSMnemonicWordCountSelectModalProps = {
  visible: boolean
  selectedWordCount: MnemonicWordCount
  onChange: (count: MnemonicWordCount) => void
  onSelect: () => void
  onCancel: () => void
}

// Modal to pick how many words a mnemonic has (24 down to 12). `onChange`
// follows the highlighted option; `onSelect` confirms it.
function SSMnemonicWordCountSelectModal({
  visible,
  selectedWordCount,
  onChange,
  onSelect,
  onCancel
}: SSMnemonicWordCountSelectModalProps) {
  return (
    <SSSelectModal
      visible={visible}
      title={t('account.mnemonic.title')}
      selectedText={`${selectedWordCount} ${t('bitcoin.words')}`}
      selectedDescription={t(`account.mnemonic.${selectedWordCount}`)}
      onSelect={onSelect}
      onCancel={onCancel}
    >
      {MNEMONIC_WORD_COUNTS.toReversed().map((count) => (
        <WordCountOption
          key={count}
          count={count}
          selected={selectedWordCount === count}
          onChange={onChange}
        />
      ))}
    </SSSelectModal>
  )
}

type WordCountOptionProps = {
  count: MnemonicWordCount
  selected: boolean
  onChange: (count: MnemonicWordCount) => void
}

function WordCountOption({ count, selected, onChange }: WordCountOptionProps) {
  function handlePress() {
    setStateWithLayoutAnimation(onChange, count)
  }

  return (
    <SSRadioButton
      label={`${count} ${t('bitcoin.words').toLowerCase()}`}
      selected={selected}
      onPress={handlePress}
    />
  )
}

export default SSMnemonicWordCountSelectModal
