import { ScrollView, StyleSheet, View } from 'react-native'

import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'
import {
  type UtxoGroupMode,
  type UtxoKeychainFilter,
  type UtxoLabelFilter,
  type UtxoListFilter,
  type UtxoScriptFilter,
  type UtxoTagFilter
} from '@/utils/utxoList'
import {
  UTXO_SCRIPT_FILTER_PAIRS,
  utxoGroupModeLabel
} from '@/utils/utxoListUi'

import SSButton from './SSButton'
import SSIconButton from './SSIconButton'
import SSModal from './SSModal'
import SSRadioButton from './SSRadioButton'
import SSText from './SSText'

type SSUtxoListControlsModalProps = {
  visible: boolean
  filter: UtxoListFilter
  groupMode: UtxoGroupMode
  onClose: () => void
  onReset: () => void
  onKeychainChange: (keychain: UtxoKeychainFilter) => void
  onLabelChange: (label: UtxoLabelFilter) => void
  onScriptChange: (script: UtxoScriptFilter) => void
  onTagChange: (tag: UtxoTagFilter) => void
  onGroupModeChange: (mode: UtxoGroupMode) => void
}

const GROUP_MODE_PAIRS: [UtxoGroupMode, UtxoGroupMode][] = [
  ['address', 'label'],
  ['tag', 'keychain']
]

function SSUtxoListControlsModal({
  visible,
  filter,
  groupMode,
  onClose,
  onReset,
  onKeychainChange,
  onLabelChange,
  onScriptChange,
  onTagChange,
  onGroupModeChange
}: SSUtxoListControlsModalProps) {
  return (
    <SSModal visible={visible} onClose={onClose} fullOpacity showLabel={false}>
      <SSVStack gap="md" style={styles.shell}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="lg" style={styles.content}>
            <SSHStack gap="none" style={styles.header}>
              <SSIconButton onPress={onClose} style={styles.headerBack}>
                <SSIconBackArrow
                  height={24}
                  stroke={Colors.gray[200]}
                  width={24}
                />
              </SSIconButton>
              <SSText uppercase center style={styles.headerTitle}>
                {t('utxo.filter.title')}
              </SSText>
              <View style={styles.headerSpacer} />
            </SSHStack>

            <SSVStack gap="sm">
              <SSText color="muted" uppercase center>
                {t('utxo.filter.tag.label')}
              </SSText>
              <SSVStack gap="xs">
                <SSRadioButton
                  variant="outline"
                  label={t('utxo.filter.tag.all')}
                  selected={filter.tag === 'all'}
                  onPress={() => onTagChange('all')}
                />
                <SSHStack gap="xs" style={styles.pairRow}>
                  <SSRadioButton
                    variant="outline"
                    label={t('utxo.filter.tag.tagged')}
                    selected={filter.tag === 'tagged'}
                    onPress={() => onTagChange('tagged')}
                    style={styles.halfOption}
                  />
                  <SSRadioButton
                    variant="outline"
                    label={t('utxo.filter.tag.untagged')}
                    selected={filter.tag === 'untagged'}
                    onPress={() => onTagChange('untagged')}
                    style={styles.halfOption}
                  />
                </SSHStack>
              </SSVStack>
            </SSVStack>

            <SSVStack gap="sm">
              <SSText color="muted" uppercase center>
                {t('utxo.filter.script.label')}
              </SSText>
              <SSVStack gap="xs">
                <SSRadioButton
                  variant="outline"
                  label={t('utxo.filter.script.all')}
                  selected={filter.script === 'all'}
                  onPress={() => onScriptChange('all')}
                />
                {UTXO_SCRIPT_FILTER_PAIRS.map(([left, right]) => (
                  <SSHStack key={left} gap="xs" style={styles.pairRow}>
                    <SSRadioButton
                      variant="outline"
                      label={left}
                      selected={filter.script === left}
                      onPress={() => onScriptChange(left)}
                      style={styles.halfOption}
                    />
                    <SSRadioButton
                      variant="outline"
                      label={right}
                      selected={filter.script === right}
                      onPress={() => onScriptChange(right)}
                      style={styles.halfOption}
                    />
                  </SSHStack>
                ))}
                <SSRadioButton
                  variant="outline"
                  label="P2TR"
                  selected={filter.script === 'P2TR'}
                  onPress={() => onScriptChange('P2TR')}
                />
              </SSVStack>
            </SSVStack>

            <SSVStack gap="sm">
              <SSText color="muted" uppercase center>
                {t('utxo.filter.keychain.label')}
              </SSText>
              <SSVStack gap="xs">
                <SSRadioButton
                  variant="outline"
                  label={t('utxo.filter.keychain.all')}
                  selected={filter.keychain === 'all'}
                  onPress={() => onKeychainChange('all')}
                />
                <SSHStack gap="xs" style={styles.pairRow}>
                  <SSRadioButton
                    variant="outline"
                    label={t('utxo.filter.keychain.receive')}
                    selected={filter.keychain === 'external'}
                    onPress={() => onKeychainChange('external')}
                    style={styles.halfOption}
                  />
                  <SSRadioButton
                    variant="outline"
                    label={t('utxo.filter.keychain.change')}
                    selected={filter.keychain === 'internal'}
                    onPress={() => onKeychainChange('internal')}
                    style={styles.halfOption}
                  />
                </SSHStack>
              </SSVStack>
            </SSVStack>

            <SSVStack gap="sm">
              <SSText color="muted" uppercase center>
                {t('utxo.filter.label.label')}
              </SSText>
              <SSVStack gap="xs">
                <SSRadioButton
                  variant="outline"
                  label={t('utxo.filter.label.all')}
                  selected={filter.label === 'all'}
                  onPress={() => onLabelChange('all')}
                />
                <SSHStack gap="xs" style={styles.pairRow}>
                  <SSRadioButton
                    variant="outline"
                    label={t('utxo.filter.label.labeled')}
                    selected={filter.label === 'labeled'}
                    onPress={() => onLabelChange('labeled')}
                    style={styles.halfOption}
                  />
                  <SSRadioButton
                    variant="outline"
                    label={t('utxo.filter.label.unlabeled')}
                    selected={filter.label === 'unlabeled'}
                    onPress={() => onLabelChange('unlabeled')}
                    style={styles.halfOption}
                  />
                </SSHStack>
              </SSVStack>
            </SSVStack>

            <SSVStack gap="sm">
              <SSText color="muted" uppercase center>
                {t('utxo.group.title')}
              </SSText>
              <SSVStack gap="xs">
                <SSRadioButton
                  variant="outline"
                  label={utxoGroupModeLabel('none')}
                  selected={groupMode === 'none'}
                  onPress={() => onGroupModeChange('none')}
                />
                {GROUP_MODE_PAIRS.map(([left, right]) => (
                  <SSHStack key={left} gap="xs" style={styles.pairRow}>
                    <SSRadioButton
                      variant="outline"
                      label={utxoGroupModeLabel(left)}
                      selected={groupMode === left}
                      onPress={() => onGroupModeChange(left)}
                      style={styles.halfOption}
                    />
                    <SSRadioButton
                      variant="outline"
                      label={utxoGroupModeLabel(right)}
                      selected={groupMode === right}
                      onPress={() => onGroupModeChange(right)}
                      style={styles.halfOption}
                    />
                  </SSHStack>
                ))}
              </SSVStack>
            </SSVStack>
          </SSVStack>
        </ScrollView>
        <SSHStack gap="sm" style={styles.footer}>
          <SSButton
            label={t('common.reset')}
            variant="ghost"
            onPress={onReset}
            style={styles.footerButton}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={onClose}
            style={styles.footerButton}
          />
        </SSHStack>
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  content: {
    width: '100%'
  },
  footer: {
    width: '100%'
  },
  footerButton: {
    flex: 1
  },
  halfOption: {
    flex: 1,
    width: undefined
  },
  header: {
    width: '100%'
  },
  headerBack: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40
  },
  headerSpacer: {
    height: 40,
    width: 40
  },
  headerTitle: {
    flex: 1
  },
  pairRow: {
    width: '100%'
  },
  scroll: {
    flexGrow: 0,
    maxHeight: '100%',
    width: '100%'
  },
  scrollContent: {
    paddingBottom: Layout.vStack.gap.md
  },
  shell: {
    width: '100%'
  }
})

export default SSUtxoListControlsModal
