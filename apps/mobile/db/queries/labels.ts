import { type Label } from '@/types/bips/329'

import { getDb } from '../connection'
import { type LabelRow, rowToLabel } from '../mappers'

function getLabelsByAccount(accountId: string): Record<string, Label> {
  const db = getDb()
  const { rows } = db.execute<LabelRow>(
    'SELECT * FROM labels WHERE account_id = ?',
    [accountId]
  )
  const labels: Record<string, Label> = {}
  for (const row of rows._array) {
    const label = rowToLabel(row)
    labels[label.ref] = label
  }
  return labels
}

function getLabel(accountId: string, ref: string): Label | undefined {
  const db = getDb()
  const row = db
    .execute<LabelRow>(
      'SELECT * FROM labels WHERE account_id = ? AND ref = ?',
      [accountId, ref]
    )
    .rows.item(0)
  if (!row) {
    return undefined
  }
  return rowToLabel(row)
}

function getLabelsByType(accountId: string, type: Label['type']): Label[] {
  const db = getDb()
  const { rows } = db.execute<LabelRow>(
    'SELECT * FROM labels WHERE account_id = ? AND type = ?',
    [accountId, type]
  )
  return rows._array.map((row) => rowToLabel(row))
}

export { getLabel, getLabelsByAccount, getLabelsByType }
