import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/outpoint'

const EXCLUDE_TOAST_DURATION_MS = 5000

function excludeUtxoWithUndo(accountId: Account['id'], utxo: Utxo) {
  const outpoint = getUtxoOutpoint(utxo)
  useAccountsStore.getState().excludeUtxoOutpoints(accountId, [outpoint])

  toast(t('utxo.exclude.toast'), {
    action: {
      label: t('common.undo'),
      onClick: () => {
        useAccountsStore.getState().includeUtxoOutpoints(accountId, [outpoint])
      }
    },
    duration: EXCLUDE_TOAST_DURATION_MS
  })
}

function toggleUtxoExcluded(accountId: Account['id'], utxo: Utxo) {
  const outpoint = getUtxoOutpoint(utxo)
  const account = useAccountsStore
    .getState()
    .accounts.find((entry) => entry.id === accountId)
  const excluded = account?.excludedUtxoOutpoints?.includes(outpoint) ?? false

  if (excluded) {
    useAccountsStore.getState().includeUtxoOutpoints(accountId, [outpoint])
    return
  }

  excludeUtxoWithUndo(accountId, utxo)
}

export { excludeUtxoWithUndo, toggleUtxoExcluded }
