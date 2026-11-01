import { type BrantaPayee } from '@/types/models/Branta'

import { getDb } from '../connection'

function saveBrantaPayee(accountId: string, txId: string, payee: BrantaPayee) {
  const db = getDb()
  db.execute(
    `INSERT INTO branta_payees (
      account_id, tx_id, name, logo_url, description, verify_url, parent_logo_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, tx_id) DO UPDATE SET
      name = excluded.name,
      logo_url = excluded.logo_url,
      description = excluded.description,
      verify_url = excluded.verify_url,
      parent_logo_url = excluded.parent_logo_url`,
    [
      accountId,
      txId,
      payee.name,
      payee.logoUrl,
      payee.description,
      payee.verifyUrl,
      payee.parentLogoUrl ?? null
    ]
  )
}

export { saveBrantaPayee }
