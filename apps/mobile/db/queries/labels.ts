import { type Label } from '@/utils/bip329'

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

function getLabel(accountId: string, ref: string): Label | undefined {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM labels WHERE account_id = ? AND ref = ?',
    [accountId, ref]
  )
  if (!results || results.length === 0) {
    return undefined
  }
  return rowToLabel(results[0] as LabelRow)
}

function getLabelsByType(accountId: string, type: Label['type']): Label[] {
  const db = getDb()
  const { results } = db.execute(
    'SELECT * FROM labels WHERE account_id = ? AND type = ?',
    [accountId, type]
  )
  return (results ?? []).map((row) => rowToLabel(row as LabelRow))
}

export { getLabel, getLabelsByAccount, getLabelsByType }
