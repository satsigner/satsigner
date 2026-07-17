import { type Label } from '@/types/bips/329'

import { getDb } from '../connection'

function setArkLabel(
  accountId: string,
  ref: string,
  type: Label['type'],
  label: string
) {
  const db = getDb()
  if (label === '') {
    db.execute('DELETE FROM ark_labels WHERE ref = ? AND account_id = ?', [
      ref,
      accountId
    ])
    return
  }
  db.execute(
    `INSERT INTO ark_labels (ref, account_id, type, label) VALUES (?, ?, ?, ?)
     ON CONFLICT(ref, account_id) DO UPDATE SET type = excluded.type, label = excluded.label`,
    [ref, accountId, type, label]
  )
}

function deleteArkLabelsByAccount(accountId: string) {
  const db = getDb()
  db.execute('DELETE FROM ark_labels WHERE account_id = ?', [accountId])
}

export { deleteArkLabelsByAccount, setArkLabel }
