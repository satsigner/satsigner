import { type BrantaPayee } from '@/types/models/Branta'

import { getDb } from '../connection'

type BrantaPayeeRow = {
  account_id: string
  description: string
  logo_url: string
  name: string
  parent_logo_url: string | null
  tx_id: string
  verify_url: string
}

function rowToBrantaPayee(row: BrantaPayeeRow): BrantaPayee {
  return {
    description: row.description,
    logoUrl: row.logo_url,
    name: row.name,
    parentLogoUrl: row.parent_logo_url ?? undefined,
    verifyUrl: row.verify_url
  }
}

function getBrantaPayeesByAccount(accountId: string): Map<string, BrantaPayee> {
  const db = getDb()
  const { rows } = db.execute<BrantaPayeeRow>(
    'SELECT * FROM branta_payees WHERE account_id = ?',
    [accountId]
  )
  const payees = new Map<string, BrantaPayee>()
  for (const row of rows._array) {
    payees.set(row.tx_id, rowToBrantaPayee(row))
  }
  return payees
}

export { getBrantaPayeesByAccount }
