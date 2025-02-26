import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useFocusEffect } from '@react-navigation/native'
import { useReducer } from 'react'
import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSButton from './SSButton'
import SSText from './SSText'

interface SSUtxoSelectionProps {
  onClose: () => void
  onSave: () => void
}

type UtxoOption = {
  id: string
  label: string
  isActive: boolean
  description: string
}

type UtxoAction = {
  type: 'SELECT_OPTION'
  id: string
}

function utxoReducer(state: UtxoOption[], action: UtxoAction): UtxoOption[] {
  switch (action.type) {
    case 'SELECT_OPTION':
      return state.map((option) => ({
        ...option,
        isActive: option.id === action.id
      }))
    default:
      return state
  }
}

const initialOptions: UtxoOption[] = [
  {
    id: 'user',
    label: t('utxo.selection.user'),
    isActive: true,
    description: t('utxo.description.user')
  },
  {
    id: 'privacy',
    label: t('utxo.selection.privacy'),
    isActive: false,
    description: t('utxo.description.privacy')
  },
  {
    id: 'efficiency',
    label: t('utxo.selection.efficiency'),
    isActive: false,
    description: t('utxo.description.efficiency')
  },
  {
    id: 'advanced',
    label: 'Advanced',
    isActive: false,
    description: t('utxo.description.advanced')
  }
]

export default function SSUtxoSelection({
  onClose,
  onSave
}: SSUtxoSelectionProps) {
  const [options, dispatch] = useReducer(utxoReducer, initialOptions)
  const activeOption = options.find((option) => option.isActive)

  return (
    <SSVStack style={styles.container}>
      <View style={styles.header}>
        <SSText size="sm" weight="bold">
          {t('common.options')}
        </SSText>
      </View>

      <SSText size="sm" color="muted" uppercase style={styles.subtitle}>
        {t('utxo.autoSelect')}
      </SSText>

      <View style={styles.scrollViewContainer}>
        <BottomSheetScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollContainer}
          contentContainerStyle={styles.contentContainer}
          focusHook={useFocusEffect}
        >
          {options.map((option) => (
            <SSButton
              key={option.id}
              variant="outline"
              label={option.label}
              style={[styles.button, option.isActive && styles.activeButton]}
              textStyle={option.isActive && styles.activeButtonText}
              onPress={() => dispatch({ type: 'SELECT_OPTION', id: option.id })}
            />
          ))}
        </BottomSheetScrollView>
      </View>
      <SSText
        size="xs"
        color="muted"
        style={[styles.description, { opacity: activeOption ? 1 : 0 }]}
      >
        {activeOption
          ? activeOption.description
          : initialOptions[0].description}
      </SSText>

      <View style={styles.buttonGroup}>
        <SSHStack gap="lg" style={{ width: '100%' }}>
          <SSButton
            style={styles.fee_button}
            variant="outline"
            label={t('utxo.selection.feeControl')}
          />
          <SSButton
            style={styles.fee_button}
            variant="outline"
            label={t('utxo.selection.timelock')}
          />
        </SSHStack>
      </View>
      <SSButton variant="outline" label={t('utxo.selection.importOutputs')} />

      <SSButton variant="secondary" label={t('common.save')} onPress={onSave} />
      <SSButton variant="ghost" label={t('common.cancel')} onPress={onClose} />
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24
  },
  scrollViewContainer: {
    height: 60
  },
  scrollContainer: {
    flex: 1
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  header: {
    alignItems: 'center',
    marginTop: 16
  },
  subtitle: {},
  button: {
    width: 105,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.gray[800]
  },
  activeButton: {
    borderWidth: 1,
    borderColor: Colors.white
  },
  activeButtonText: {
    color: Colors.white,
    fontWeight: 'bold'
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  fee_button: {
    flex: 1
  },
  timelock_button: {
    flex: 1
  },
  description: {
    margin: 0,
    width: '70%'
  },
  importButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gray[800],
    alignItems: 'center',
    marginBottom: 24
  },
  saveButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: 'center',
    marginBottom: 16
  },
  cancelText: {
    textAlign: 'center'
  }
})
