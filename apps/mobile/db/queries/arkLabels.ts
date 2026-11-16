import type { Label } from '@/types/bips/329'

import { getDb } from '../connection'
import { rowToArkLabel } from '../mappers'
import type { ArkLabelRow } from '../mappers'

function getArkLabelsByAccount(accountId: string): Record<string, Label> {
  const db = getDb()
  const { rows } = db.execute<ArkLabelRow>(
    'SELECT * FROM ark_labels WHERE account_id = ?',
    [accountId]
  )
  const labels: Record<string, Label> = {}
  for (const row of rows._array) {
    const label = rowToArkLabel(row)
    labels[label.ref] = label
  }
  return labels
}

export { getArkLabelsByAccount }
