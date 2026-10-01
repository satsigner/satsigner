import { type Label } from '@/types/bips/329'

import { getDb } from '../connection'
import { type LabelRow, rowToLabel } from '../mappers'

function getLabelsByAccount(accountId: string): Record<string, Label> {
  const db = getDb()
  const { results } = db.execute('SELECT * FROM labels WHERE account_id = ?', [
    accountId
  ])
  const labels: Record<string, Label> = {}
  for (const row of results ?? []) {
    const label = rowToLabel(row as LabelRow)
    labels[label.ref] = label
  }
  return labels
}

export { getLabelsByAccount }
