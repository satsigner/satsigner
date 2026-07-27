import { ScrollView, StyleSheet } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Layout } from '@/styles'
import {
  type UtxoGroupMode,
  type UtxoKeychainFilter,
  type UtxoLabelFilter,
  type UtxoListFilter
} from '@/utils/utxoList'
import { UTXO_GROUP_MODES, utxoGroupModeLabel } from '@/utils/utxoListUi'

import SSModal from './SSModal'
import SSRadioButton from './SSRadioButton'
import SSText from './SSText'

type SSUtxoListControlsModalProps = {
  visible: boolean
  filter: UtxoListFilter
  groupMode: UtxoGroupMode
  onClose: () => void
  onKeychainChange: (keychain: UtxoKeychainFilter) => void
  onLabelChange: (label: UtxoLabelFilter) => void
  onGroupModeChange: (mode: UtxoGroupMode) => void
}

const KEYCHAIN_OPTIONS = [
  ['all', 'utxo.filter.keychain.all'],
  ['external', 'utxo.filter.keychain.receive'],
  ['internal', 'utxo.filter.keychain.change']
] as const

const LABEL_OPTIONS = [
  ['all', 'utxo.filter.label.all'],
  ['labeled', 'utxo.filter.label.labeled'],
  ['unlabeled', 'utxo.filter.label.unlabeled']
] as const

function SSUtxoListControlsModal({
  visible,
  filter,
  groupMode,
  onClose,
  onKeychainChange,
  onLabelChange,
  onGroupModeChange
}: SSUtxoListControlsModalProps) {
  return (
    <SSModal visible={visible} onClose={onClose} fullOpacity>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SSVStack gap="lg" style={styles.content}>
          <SSText uppercase center>
            {t('utxo.filter.title')}
          </SSText>

          <SSVStack gap="sm">
            <SSText color="muted">{t('utxo.group.title')}</SSText>
            <SSVStack gap="xs">
              {UTXO_GROUP_MODES.map((mode) => (
                <SSRadioButton
                  key={mode}
                  variant="outline"
                  label={utxoGroupModeLabel(mode)}
                  selected={groupMode === mode}
                  onPress={() => onGroupModeChange(mode)}
                />
              ))}
            </SSVStack>
          </SSVStack>

          <SSVStack gap="sm">
            <SSText color="muted">{t('utxo.filter.keychain.label')}</SSText>
            <SSVStack gap="xs">
              {KEYCHAIN_OPTIONS.map(([value, labelKey]) => (
                <SSRadioButton
                  key={value}
                  variant="outline"
                  label={t(labelKey)}
                  selected={filter.keychain === value}
                  onPress={() => onKeychainChange(value)}
                />
              ))}
            </SSVStack>
          </SSVStack>

          <SSVStack gap="sm">
            <SSText color="muted">{t('utxo.filter.label.label')}</SSText>
            <SSVStack gap="xs">
              {LABEL_OPTIONS.map(([value, labelKey]) => (
                <SSRadioButton
                  key={value}
                  variant="outline"
                  label={t(labelKey)}
                  selected={filter.label === value}
                  onPress={() => onLabelChange(value)}
                />
              ))}
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  content: {
    width: '100%'
  },
  scroll: {
    flexGrow: 0,
    maxHeight: '100%',
    width: '100%'
  },
  scrollContent: {
    paddingBottom: Layout.vStack.gap.md
  }
})

export default SSUtxoListControlsModal
