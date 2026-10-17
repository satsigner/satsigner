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
            <SSButton
              key={wordCount}
              label={t('transaction.preview.wordsCount', { count: wordCount })}
              variant={selectedWordCount === wordCount ? 'outline' : 'ghost'}
              onPress={() => setSelectedWordCount(wordCount)}
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

export default SSWordCountSelectModal
