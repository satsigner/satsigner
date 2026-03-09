import { nip19 } from 'nostr-tools'
import { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner-native'

import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import {
  DM_FUTURE_TOLERANCE_SEC,
  type NostrMessage,
  type PendingDM,
  type UnwrappedNostrEvent
} from '@/types/nostrMessageHandlers'
import { getPubKeyHexFromNpub } from '@/utils/nostr'

import {
  getAuthorDisplayName,
  isChatActive,
  TOAST_CONTENT_MAX,
  TOAST_DURATION
} from './useNostrNotifyUtils'

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

function getDevicePubkeyHex(
  account: Account | null | undefined
): string | null {
  const npub = account?.nostr?.deviceNpub
  return npub ? getPubKeyHexFromNpub(npub) : null
}

function samePubkey(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

function isSenderAllowed(account: Account, senderPubkeyHex: string): boolean {
  if (!account?.nostr) return false
  const deviceHex = getDevicePubkeyHex(account)
  if (deviceHex && samePubkey(senderPubkeyHex, deviceHex)) return true
  try {
    const senderNpub = nip19.npubEncode(senderPubkeyHex)
    return (account.nostr.trustedMemberDevices || []).includes(senderNpub)
  } catch {
    return false
  }
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

// Debounce delay for batching DM storage writes
const DM_STORAGE_DEBOUNCE_MS = 500

function useNostrDMStorage() {
  // Accumulator for pending DMs across multiple storeBatch calls
  const pendingDmsRef = useRef<Map<string, PendingDM[]>>(new Map())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const store = useCallback(
    async (
      account: Account,
      unwrappedEvent: UnwrappedNostrEvent,
      eventContent: Record<string, unknown>
    ) => {
      const created_at = eventContent.created_at as number
      if (created_at > Date.now() / 1000 + DM_FUTURE_TOLERANCE_SEC) return

      const newMessage = buildNewMessage(unwrappedEvent, eventContent)

      // Read latest accounts from store to avoid stale closure
      const currentAccount = useAccountsStore
        .getState()
        .accounts.find((a) => a.id === account.id)
      if (!currentAccount?.nostr) return

      // Validate sender before showing toast or storing message
      if (!isSenderAllowed(currentAccount, unwrappedEvent.pubkey)) return

      // Notify for messages sent after the last sync started, not from self,
      // and no older than 5 minutes. We intentionally do NOT filter against
      // lastDataExchangeEOSE here: that timestamp is set when EOSE arrives,
      // which is AFTER all historical events have been queued — so comparing
      // created_at against it would suppress every message from the initial
      // batch, even ones the user genuinely hasn't seen yet.
      const syncStartSec = getSyncStartSeconds(currentAccount)
      if (
        !isChatActive(currentAccount.id) &&
        created_at >= syncStartSec &&
        currentAccount.nostr?.deviceNpub !==
          nip19.npubEncode(unwrappedEvent.pubkey) &&
        created_at > Date.now() / 1000 - 60 * 5
      ) {
        const author = getAuthorDisplayName(unwrappedEvent.pubkey)
        const preview = newMessage.description.slice(0, TOAST_CONTENT_MAX)
        toast.info('New Device Message', {
          description: `${author}\n${preview}`,
          duration: TOAST_DURATION
        })
      }

      let currentDms = currentAccount.nostr.dms || []

      // Check if message with same ID already exists
      const messageExists = currentDms.some((m) => m.id === newMessage.id)
      if (messageExists) return

      // If this is our own message (echo from relay), replace any matching pending
      const deviceHex = getDevicePubkeyHex(currentAccount)
      const isOwnMessage = !!(
        deviceHex && samePubkey(newMessage.author, deviceHex)
      )

      if (isOwnMessage) {
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

      const incomingMessage = isOwnMessage
        ? newMessage
        : { ...newMessage, read: false }
      const updatedDms = [...currentDms, incomingMessage].sort(
        (a, b) => a.created_at - b.created_at
      )
      useAccountsStore.getState().updateAccountNostr(account.id, {
        dms: updatedDms
      })
    },
    []
  )

  // Flush all accumulated pending DMs to storage (the actual expensive operation)
  const flushPendingDms = useCallback((accountId: string) => {
    const pendingDms = pendingDmsRef.current.get(accountId) || []
    if (pendingDms.length === 0) return

    // Clear the accumulated DMs for this account
    pendingDmsRef.current.delete(accountId)

    const currentAccount = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (!currentAccount?.nostr) return

    let currentDms = [...(currentAccount.nostr.dms || [])]
    const existingIds = new Set(currentDms.map((m) => m.id))
    const syncStartSec = getSyncStartSeconds(currentAccount)
    const deviceHex = getDevicePubkeyHex(currentAccount)

    for (const { unwrappedEvent, eventContent, skipToast } of pendingDms) {
      if (!isSenderAllowed(currentAccount, unwrappedEvent.pubkey)) continue

      const created_at = eventContent.created_at as number
      if (created_at > Date.now() / 1000 + DM_FUTURE_TOLERANCE_SEC) continue

      const newMessage = buildNewMessage(unwrappedEvent, eventContent)
      if (existingIds.has(newMessage.id)) continue
      existingIds.add(newMessage.id)

      const isOwnMsg = !!(deviceHex && samePubkey(newMessage.author, deviceHex))
      if (isOwnMsg) {
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
        currentDms.push({ ...newMessage, read: false })
      }

      const description = (eventContent.description as string) ?? ''
      if (
        !skipToast &&
        !isChatActive(currentAccount.id) &&
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
      .updateAccountNostr(accountId, { dms: updatedDms })
  }, [])

  // Debounced storeBatch - accumulates DMs and writes to storage after delay
  const storeBatch = useCallback(
    async (account: Account, pendingDms: PendingDM[]) => {
      if (pendingDms.length === 0) return

      // Accumulate DMs for this account
      const existing = pendingDmsRef.current.get(account.id) || []
      pendingDmsRef.current.set(account.id, [...existing, ...pendingDms])

      // Cancel existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new debounced flush
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        // Flush all accounts that have pending DMs
        for (const accountId of pendingDmsRef.current.keys()) {
          flushPendingDms(accountId)
        }
      }, DM_STORAGE_DEBOUNCE_MS)
    },
    [flushPendingDms]
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

  return useMemo(
    () => ({
      store,
      storeBatch,
      load,
      clear
    }),
    [store, storeBatch, load, clear]
  )
}

export { buildNewMessage, getSyncStartSeconds, useNostrDMStorage }
export default useNostrDMStorage
