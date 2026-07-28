import { t } from '@/locales'
import { type ScriptVersionType } from '@/types/models/Script'
import { type UtxoGroupMode, type UtxoSortField } from '@/utils/utxoList'

const UTXO_SORT_FIELDS: UtxoSortField[] = ['amount', 'label', 'date']

const UTXO_GROUP_MODES: UtxoGroupMode[] = [
  'none',
  'address',
  'label',
  'tag',
  'keychain'
]

/** Scripts detectable from address (nested P2SH-* resolve as P2SH). */
const UTXO_SCRIPT_FILTER_OPTIONS: ScriptVersionType[] = [
  'P2PKH',
  'P2SH',
  'P2WPKH',
  'P2WSH',
  'P2TR'
]

const UTXO_SCRIPT_FILTER_PAIRS: [ScriptVersionType, ScriptVersionType][] = [
  ['P2PKH', 'P2SH'],
  ['P2WPKH', 'P2WSH']
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
  UTXO_SCRIPT_FILTER_OPTIONS,
  UTXO_SCRIPT_FILTER_PAIRS,
  UTXO_SORT_FIELDS,
  utxoGroupModeLabel,
  utxoSortFieldLabel
}
