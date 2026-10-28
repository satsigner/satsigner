import { nip19 } from 'nostr-tools'
import { toast } from 'sonner-native'

import {
  NOSTR_DM_FUTURE_TOLERANCE_SEC,
  NOSTR_DM_NOTIFY_MAX_AGE_SECS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import {
  type NostrDM,
  type NostrPendingDM,
  type NostrUnwrappedEvent
} from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { findOptimisticEcho, samePubkey } from '@/utils/nostrDms'

import {
  getAuthorDisplayName,
  isChatActive,
  TOAST_CONTENT_MAX,
  TOAST_DURATION
} from './useNostrNotifyUtils'

/**
 * Sync start in unix seconds. `new Date` also accepts a sync start that was
 * rehydrated as an ISO string.
 */
function getSyncStartSeconds(account: Account): number {
  const syncStart = account.nostr?.syncStart
  if (!syncStart) {
    return 0
  }
  return Math.floor(new Date(syncStart).getTime() / MS_PER_SECOND)
}

function getDevicePubkeyHex(
  account: Account | null | undefined
): string | null {
  const npub = account?.nostr?.deviceNpub
  return npub ? getPubKeyHexFromNpub(npub) : null
}

function isSenderAllowed(account: Account, senderPubkeyHex: string): boolean {
  if (!account?.nostr) {
    return false
  }
  const deviceHex = getDevicePubkeyHex(account)
  if (deviceHex && samePubkey(senderPubkeyHex, deviceHex)) {
    return true
  }
  try {
    const senderNpub = nip19.npubEncode(senderPubkeyHex)
    return (account.nostr.trustedMemberDevices || []).includes(senderNpub)
  } catch {
    return false
  }
}

/** Sender check against the latest stored account (trust may have changed). */
function isSenderAllowedForAccount(
  accountId: string,
  senderPubkeyHex: string
): boolean {
  const account = useAccountsStore
    .getState()
    .accounts.find((a) => a.id === accountId)
  return !!account && isSenderAllowed(account, senderPubkeyHex)
}

/**
 * Builds the stored DM for a decrypted event. Returns null when the content
 * has no numeric `created_at`, so callers skip the malformed event.
 */
function buildNewMessage(
  unwrappedEvent: NostrUnwrappedEvent,
  eventContent: Record<string, unknown>
): NostrDM | null {
  const { created_at } = eventContent
  if (typeof created_at !== 'number') {
    return null
  }
  const description =
    typeof eventContent.description === 'string' ? eventContent.description : ''
  return {
    author: unwrappedEvent.pubkey,
    content: {
      created_at,
      description,
      pubkey: unwrappedEvent.pubkey
    },
    created_at,
    description,
    event: JSON.stringify(unwrappedEvent),
    id: unwrappedEvent.id,
    label: 1
  }
}

function isFromTheFuture(createdAt: number, nowSec: number): boolean {
  return createdAt > nowSec + NOSTR_DM_FUTURE_TOLERANCE_SEC
}

/**
 * Notify for messages sent after the last sync started, not from self, and
 * no older than a few minutes. lastDataExchangeEOSE is intentionally not used:
 * it is set after historical events were queued, so it would suppress every
 * message of the initial batch.
 */
function shouldNotify(
  account: Account,
  dm: NostrDM,
  isOwnMessage: boolean,
  nowSec: number
): boolean {
  return (
    !isOwnMessage &&
    !isChatActive(account.id) &&
    dm.created_at >= getSyncStartSeconds(account) &&
    dm.created_at > nowSec - NOSTR_DM_NOTIFY_MAX_AGE_SECS
  )
}

function notifyNewDeviceMessage(dm: NostrDM): void {
  const author = getAuthorDisplayName(dm.author)
  const preview = dm.description.slice(0, TOAST_CONTENT_MAX)
  toast.info(t('account.nostrSync.newDeviceMessage'), {
    description: `${author}\n${preview}`,
    duration: TOAST_DURATION
  })
}

type NostrDmBatchOutcome = {
  /** Rumor ids not stored yet (untrusted sender, future date): retry later. */
  deferredIds: string[]
}

/**
 * Writes the DMs found in one processed batch: one SQLite transaction and
 * one store update for new messages, and the relay echo of a message this
 * device sent replaces its optimistic copy. Throws when the write fails so
 * the caller leaves the events unprocessed.
 */
function storeNostrDmBatch(
  accountId: string,
  pendingDms: NostrPendingDM[]
): NostrDmBatchOutcome {
  const accountsStore = useAccountsStore.getState()
  const account = accountsStore.accounts.find((a) => a.id === accountId)
  if (pendingDms.length === 0 || !account?.nostr) {
    return { deferredIds: [] }
  }

  const nowSec = Date.now() / MS_PER_SECOND
  const deviceHex = getDevicePubkeyHex(account)
  const storedIds = new Set(account.nostr.dms.map((dm) => dm.id))
  const fresh: NostrDM[] = []
  const deferredIds: string[] = []

  for (const { unwrappedEvent, eventContent, skipToast } of pendingDms) {
    const dm = buildNewMessage(unwrappedEvent, eventContent)
    if (!dm || storedIds.has(dm.id)) {
      continue
    }
    if (
      isFromTheFuture(dm.created_at, nowSec) ||
      !isSenderAllowed(account, unwrappedEvent.pubkey)
    ) {
      deferredIds.push(unwrappedEvent.id)
      continue
    }
    storedIds.add(dm.id)

    const isOwnMessage = !!deviceHex && samePubkey(dm.author, deviceHex)
    const optimistic = isOwnMessage
      ? findOptimisticEcho(account.nostr.dms, dm, deviceHex)
      : undefined
    if (optimistic) {
      accountsStore.replaceAccountDm(accountId, optimistic.id, dm)
      continue
    }

    fresh.push(isOwnMessage ? dm : { ...dm, read: false })
    if (!skipToast && shouldNotify(account, dm, isOwnMessage, nowSec)) {
      notifyNewDeviceMessage(dm)
    }
  }

  accountsStore.addAccountDms(accountId, fresh)
  return { deferredIds }
}

function useNostrDMStorage() {
  function store(
    account: Account,
    unwrappedEvent: NostrUnwrappedEvent,
    eventContent: Record<string, unknown>
  ) {
    storeNostrDmBatch(account.id, [{ eventContent, unwrappedEvent }])
  }

  function storeBatch(account: Account, pendingDms: NostrPendingDM[]) {
    storeNostrDmBatch(account.id, pendingDms)
  }

  function load(account?: Account) {
    return account?.nostr?.dms || []
  }

  function clear(account?: Account) {
    if (!account?.nostr) {
      return
    }
    // Only update dms so we never overwrite device keys (e.g. from stale account ref)
    useAccountsStore.getState().updateAccountNostr(account.id, { dms: [] })
  }

  return { clear, load, store, storeBatch }
}

export type { NostrDmBatchOutcome }
export {
  buildNewMessage,
  getSyncStartSeconds,
  isSenderAllowed,
  isSenderAllowedForAccount,
  storeNostrDmBatch,
  useNostrDMStorage
}
