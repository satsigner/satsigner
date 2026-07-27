import { t } from '@/locales'
import { type UtxoGroupMode, type UtxoSortField } from '@/utils/utxoList'

const UTXO_SORT_FIELDS: UtxoSortField[] = ['amount', 'label', 'date']

const UTXO_GROUP_MODES: UtxoGroupMode[] = [
  'none',
  'address',
  'label',
  'tag',
  'keychain'
]

function utxoSortFieldLabel(field: UtxoSortField) {
  if (field === 'date') {
    return t('utxo.sort.date')
  }
  if (field === 'amount') {
    return t('utxo.sort.amount')
  }
  return t('utxo.sort.label')
}

function utxoGroupModeLabel(mode: UtxoGroupMode) {
  if (mode === 'none') {
    return t('utxo.group.option.none')
  }
  if (mode === 'address') {
    return t('utxo.group.option.address')
  }
  if (mode === 'label') {
    return t('utxo.group.option.label')
  }
  if (mode === 'tag') {
    return t('utxo.group.option.tag')
  }
  return t('utxo.group.option.keychain')
}

function groupDisplayTitle(mode: UtxoGroupMode, key: string, title: string) {
  if (mode === 'keychain') {
    return key === 'internal'
      ? t('utxo.group.keychain.change')
      : t('utxo.group.keychain.receive')
  }
  if (mode === 'label' && !title) {
    return t('utxo.group.unlabeled')
  }
  if (mode === 'tag' && !title) {
    return t('utxo.group.untagged')
  }
  if (mode === 'tag') {
    return `#${title}`
  }
  return title
}

export {
  groupDisplayTitle,
  UTXO_GROUP_MODES,
  UTXO_SORT_FIELDS,
  utxoGroupModeLabel,
  utxoSortFieldLabel
}
