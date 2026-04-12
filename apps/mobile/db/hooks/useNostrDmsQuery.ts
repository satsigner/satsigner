import { useQuery } from '@tanstack/react-query'

import { getDb } from '../connection'
import { nostrKeys } from '../keys'
import { rowToNostrDm } from '../mappers'

function useNostrDmsQuery(accountId: string) {
  return useQuery({
    queryFn: () => {
      const db = getDb()
      const { results } = db.execute(
        'SELECT * FROM nostr_dms WHERE account_id = ? ORDER BY created_at DESC',
        [accountId]
      )
      return (results ?? []).map((row) =>
        rowToNostrDm(row as unknown as Parameters<typeof rowToNostrDm>[0])
      )
    },
    queryKey: nostrKeys.dms(accountId),
    staleTime: Infinity
  })
}

function useNostrRelaysQuery(accountId: string) {
  return useQuery({
    queryFn: () => {
      const db = getDb()
      const { results } = db.execute(
        'SELECT url FROM nostr_relays WHERE account_id = ?',
        [accountId]
      )
      return (results ?? []).map((r) => r.url as string)
    },
    queryKey: nostrKeys.relays(accountId),
    staleTime: Infinity
  })
}

export { useNostrDmsQuery, useNostrRelaysQuery }
