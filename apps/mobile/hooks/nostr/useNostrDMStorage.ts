import { nip19 } from 'nostr-tools'
import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import {
  TOAST_CONTENT_MAX,
  TOAST_DURATION,
  getAuthorDisplayName
} from './handlers/notifyUtils'

import {
  DM_FUTURE_TOLERANCE_SEC,
  type NostrMessage,
  type PendingDM,
  type UnwrappedNostrEvent
} from './types'

const PENDING_MATCH_CREATED_AT_TOLERANCE_SEC = 10

function getSyncStartSeconds(account: Account): number {
  const syncStart = account.nostr?.syncStart
  if (!syncStart) return 0
  const ms =
    syncStart instanceof Date
      ? syncStart.getTime()
      : new Date(syncStart as string).getTime()
  return Math.floor(ms / 1000)
}

function getDevicePubkeyHex(account: Account | null | undefined): string | null {
  const npub = account?.nostr?.deviceNpub
  if (!npub) return null
  try {
    const decoded = nip19.decode(npub)
    if (decoded?.type !== 'npub' || !decoded.data) return null
    const data = decoded.data
    const hex =
      typeof data === 'string'
        ? data
        : Buffer.from(data as Uint8Array).toString('hex')
    return hex.toLowerCase()
  } catch {
    // ignore
  }
  return null
}

function samePubkey(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function buildNewMessage(
  unwrappedEvent: UnwrappedNostrEvent,
  eventContent: Record<string, unknown>
): NostrMessage {
  const created_at = eventContent.created_at as number
  const description = (eventContent.description as string) ?? ''
  return {
    id: unwrappedEvent.id,
    author: unwrappedEvent.pubkey,
    created_at,
    description,
    event: JSON.stringify(unwrappedEvent),
    label: 1,
    content: {
      description,
      created_at,
      pubkey: unwrappedEvent.pubkey
    }
  }
}

function useNostrDMStorage() {
  const store = useCallback(
    async (
      account: Account,
      unwrappedEvent: UnwrappedNostrEvent,
      eventContent: Record<string, unknown>
    ) => {
      const created_at = eventContent.created_at as number
      if (created_at > Date.now() / 1000 + DM_FUTURE_TOLERANCE_SEC) return

      const newMessage = buildNewMessage(unwrappedEvent, eventContent)

      // Notify for messages sent after the last sync started, not from self,
      // and no older than 5 minutes. We intentionally do NOT filter against
      // lastDataExchangeEOSE here: that timestamp is set when EOSE arrives,
      // which is AFTER all historical events have been queued — so comparing
      // created_at against it would suppress every message from the initial
      // batch, even ones the user genuinely hasn't seen yet.
      const syncStartSec = getSyncStartSeconds(account)
      if (
        created_at >= syncStartSec &&
        account.nostr?.deviceNpub !== nip19.npubEncode(unwrappedEvent.pubkey) &&
        created_at > Date.now() / 1000 - 60 * 5
      ) {
        const author = getAuthorDisplayName(unwrappedEvent.pubkey)
        const preview = newMessage.description.slice(0, TOAST_CONTENT_MAX)
        toast.info('New Device Message', {
          description: `${author}\n${preview}`,
          duration: TOAST_DURATION
        })
      }

      // Read latest accounts from store to avoid stale closure
      const currentAccount = useAccountsStore
        .getState()
        .accounts.find((a) => a.id === account.id)
      if (!currentAccount?.nostr) return

      let currentDms = currentAccount.nostr.dms || []

      // Check if message with same ID already exists
      const messageExists = currentDms.some((m) => m.id === newMessage.id)
      if (messageExists) return

      // If this is our own message (echo from relay), replace any matching pending
      const deviceHex = getDevicePubkeyHex(currentAccount)
      if (deviceHex && samePubkey(newMessage.author, deviceHex)) {
        const pendingIdx = currentDms.findIndex(
          (m) =>
            m.pending &&
            samePubkey(m.author, deviceHex) &&
            m.description === newMessage.description &&
            Math.abs(m.created_at - newMessage.created_at) <=
              PENDING_MATCH_CREATED_AT_TOLERANCE_SEC
        )
        if (pendingIdx >= 0) {
          currentDms = currentDms.slice()
          currentDms[pendingIdx] = newMessage
          const updatedDms = currentDms.sort(
            (a, b) => a.created_at - b.created_at
          )
          useAccountsStore.getState().updateAccountNostr(account.id, {
            dms: updatedDms
          })
          return
        }
      }

      const updatedDms = [...currentDms, newMessage].sort(
        (a, b) => a.created_at - b.created_at
      )
      useAccountsStore.getState().updateAccountNostr(account.id, {
        dms: updatedDms
      })
    },
    []
  )

  const storeBatch = useCallback(
    async (account: Account, pendingDms: PendingDM[]) => {
      if (pendingDms.length === 0) return

      // Read latest accounts from store to avoid stale closure (subscription
      // callback may run with old accounts and overwrite dms with a shorter list)
      const currentAccount = useAccountsStore
        .getState()
        .accounts.find((a) => a.id === account.id)
      if (!currentAccount?.nostr) return

      let currentDms = [...(currentAccount.nostr.dms || [])]
      const existingIds = new Set(currentDms.map((m) => m.id))
      const syncStartSec = getSyncStartSeconds(currentAccount)
      const deviceHex = getDevicePubkeyHex(currentAccount)

      for (const { unwrappedEvent, eventContent, skipToast } of pendingDms) {
        const created_at = eventContent.created_at as number
        if (created_at > Date.now() / 1000 + DM_FUTURE_TOLERANCE_SEC) continue

        const newMessage = buildNewMessage(unwrappedEvent, eventContent)
        if (existingIds.has(newMessage.id)) continue
        existingIds.add(newMessage.id)

        // If this is our own message, replace matching pending instead of dup
        if (deviceHex && samePubkey(newMessage.author, deviceHex)) {
          const pendingIdx = currentDms.findIndex(
            (m) =>
              m.pending &&
              samePubkey(m.author, deviceHex) &&
              m.description === newMessage.description &&
              Math.abs(m.created_at - newMessage.created_at) <=
                PENDING_MATCH_CREATED_AT_TOLERANCE_SEC
          )
          if (pendingIdx >= 0) {
            currentDms = currentDms.slice()
            currentDms[pendingIdx] = newMessage
          } else {
            currentDms.push(newMessage)
          }
        } else {
          currentDms.push(newMessage)
        }

        const description = (eventContent.description as string) ?? ''
        if (
          !skipToast &&
          created_at >= syncStartSec &&
          currentAccount.nostr?.deviceNpub !==
            nip19.npubEncode(unwrappedEvent.pubkey) &&
          created_at > Date.now() / 1000 - 60 * 5
        ) {
          const author = getAuthorDisplayName(unwrappedEvent.pubkey)
          const preview = description.slice(0, TOAST_CONTENT_MAX)
          toast.info('New Device Message', {
            description: `${author}\n${preview}`,
            duration: TOAST_DURATION
          })
        }
      }

      const updatedDms = currentDms.sort((a, b) => a.created_at - b.created_at)
      useAccountsStore
        .getState()
        .updateAccountNostr(account.id, { dms: updatedDms })
    },
    []
  )

  const load = useCallback(async (account?: Account) => {
    if (!account) return []
    return account.nostr?.dms || []
  }, [])

  const clear = useCallback(async (account?: Account) => {
    if (!account?.nostr) return
    // Only update dms so we never overwrite device keys (e.g. from stale account ref)
    useAccountsStore.getState().updateAccountNostr(account.id, { dms: [] })
  }, [])

  return {
    store,
    storeBatch,
    load,
    clear
  }
}

export { buildNewMessage, getSyncStartSeconds, useNostrDMStorage }
export default useNostrDMStorage
