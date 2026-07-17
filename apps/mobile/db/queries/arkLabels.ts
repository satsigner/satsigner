import { type Label } from '@/types/bips/329'

import { getDb } from '../connection'
import { type ArkLabelRow, rowToArkLabel } from '../mappers'

function getArkLabelsByAccount(accountId: string): Record<string, Label> {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM ark_labels WHERE account_id = ?',
    [accountId]
  )
  const labels: Record<string, Label> = {}
  for (const row of results ?? []) {
    const label = rowToArkLabel(row as ArkLabelRow)
    labels[label.ref] = label
  }
  return labels
}

export { getArkLabelsByAccount }
