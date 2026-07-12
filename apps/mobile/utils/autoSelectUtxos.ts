import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'

const AUTO_SELECT_UTXO_TITLE_KEYS = {
  efficiency: 'transaction.build.options.autoSelect.utxos.efficiency.title',
  privacy: 'transaction.build.options.autoSelect.utxos.privacy.title',
  user: 'transaction.build.options.autoSelect.utxos.user.title'
} as const satisfies Record<AutoSelectUtxosAlgorithm, string>

const AUTO_SELECT_UTXO_DESCRIPTION_KEYS = {
  efficiency:
    'transaction.build.options.autoSelect.utxos.efficiency.description',
  privacy: 'transaction.build.options.autoSelect.utxos.privacy.description',
  user: 'transaction.build.options.autoSelect.utxos.user.description'
} as const satisfies Record<AutoSelectUtxosAlgorithm, string>

export function autoSelectUtxosTitleKey(
  algorithm: AutoSelectUtxosAlgorithm
): (typeof AUTO_SELECT_UTXO_TITLE_KEYS)[AutoSelectUtxosAlgorithm] {
  return AUTO_SELECT_UTXO_TITLE_KEYS[algorithm]
}

export function autoSelectUtxosDescriptionKey(
  algorithm: AutoSelectUtxosAlgorithm
): (typeof AUTO_SELECT_UTXO_DESCRIPTION_KEYS)[AutoSelectUtxosAlgorithm] {
  return AUTO_SELECT_UTXO_DESCRIPTION_KEYS[algorithm]
}
