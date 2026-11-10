import * as nostrKinds from 'nostr-tools/kinds'

import { NostrAPI } from '@/api/nostr'
import {
  type NostrRumor,
  createDerivedWrapDeletion,
  parseStoredRumor,
  toNdkEvent
} from '@/api/nostrGiftWrap'
import { MS_PER_SECOND } from '@/constants/time'
import {
  deleteMessageWraps,
  getMessageWraps,
  type NostrMessageTombstone,
  tombstoneMessages
} from '@/db/nostrMessageState'
import {
  type NostrDeviceSendResult,
  buildDeviceRumor,
  buildDmPayload,
  buildPayloadRumor,
  sendDeviceDM,
  sendRumorToDevices
} from '@/hooks/useNostrPublish'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type NostrDM, type NostrUnwrappedEvent } from '@/types/models/Nostr'
import { NostrPartialSendError } from '@/utils/errors'
import { getPubKeyHexFromNpub, getSecretFromNsec } from '@/utils/nostr'
import {
  buildMessageDeletionTags,
  getDeletionTargetIds
} from '@/utils/nostrChatTags'
import { isOptimisticDmId, samePubkey } from '@/utils/nostrDms'

type DeviceChatSendOutcome = {
  /** Devices that did not get the message; empty when all were reached. */
  failedDevices: string[]
  messageId: string
  /** Why some devices failed: the partial-send error, or its cause when no device got it. */
  error?: unknown
}

function getAccount(accountId: string) {
  return useAccountsStore.getState().accounts.find((a) => a.id === accountId)
}

/**
 * The rumor is built before sending, so the optimistic copy already has the
 * id every device will store: the relay echo dedupes against it by id.
 */
function buildOptimisticDm(
  rumor: NostrRumor,
  text: string,
  replyToId?: string
): NostrDM {
  return {
    author: rumor.pubkey,
    content: {
      created_at: rumor.created_at,
      description: text,
      pubkey: rumor.pubkey
    },
    created_at: rumor.created_at,
    description: text,
    event: JSON.stringify(rumor),
    id: rumor.id,
    label: 1,
    pending: true,
    replyToId
  }
}

async function deliver(
  send: () => Promise<NostrDeviceSendResult>
): Promise<{ error?: unknown; failedDevices: string[] }> {
  try {
    await send()
    return { failedDevices: [] }
  } catch (error) {
    if (!(error instanceof NostrPartialSendError)) {
      throw error
    }
    return {
      error: error.delivered.length === 0 ? (error.cause ?? error) : error,
      failedDevices: error.failed
    }
  }
}

/**
 * Shows the message immediately (optimistic), sends it to every device and
 * keeps it when some devices failed so only those are retried later.
 */
async function sendDeviceChatMessage(
  accountId: string,
  text: string,
  replyToId?: string
): Promise<DeviceChatSendOutcome | null> {
  const account = getAccount(accountId)
  const rumor = account
    ? buildPayloadRumor(account, buildDmPayload(text), replyToId)
    : null
  if (!account || !rumor) {
    return null
  }
  const optimistic = buildOptimisticDm(rumor, text, replyToId)
  const store = useAccountsStore.getState()
  store.addAccountDms(accountId, [optimistic])

  try {
    const result = await deliver(() => sendRumorToDevices(account, rumor))
    return { ...result, messageId: optimistic.id }
  } finally {
    store.updateAccountDmStatus(accountId, optimistic.id, { pending: false })
  }
}

/** Re-sends a message only to the devices that missed it. */
async function retryDeviceChatMessage(
  accountId: string,
  message: NostrDM,
  failedDevices: string[]
): Promise<DeviceChatSendOutcome | null> {
  const account = getAccount(accountId)
  if (!account || failedDevices.length === 0) {
    return null
  }
  const rumor = parseStoredRumor(message.event)
  const result = await deliver(() =>
    rumor
      ? sendRumorToDevices(account, rumor, failedDevices)
      : sendDeviceDM(account, message.description, {
          onlyDevices: failedDevices
        })
  )
  return { ...result, messageId: message.id }
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function forgetDeviceMessages(
  accountId: string,
  tombstones: NostrMessageTombstone[]
): void {
  if (tombstones.length === 0) {
    return
  }
  const ids = tombstones.map((tombstone) => tombstone.messageId)
  tombstoneMessages(accountId, tombstones, nowInSeconds())
  deleteMessageWraps(accountId, ids)
  useAccountsStore.getState().removeAccountDms(accountId, ids)
}

function deleteDeviceMessageForMe(accountId: string, message: NostrDM): void {
  forgetDeviceMessages(accountId, [
    { author: message.author, messageId: message.id }
  ])
}

function isOwnDeviceMessage(account: Account, message: NostrDM): boolean {
  const deviceHex = account.nostr?.deviceNpub
    ? getPubKeyHexFromNpub(account.nostr.deviceNpub)
    : null
  return deviceHex !== null && samePubkey(message.author, deviceHex)
}

/** Asks relays to drop the wraps this device published, one key per wrap. */
async function requestDeviceWrapDeletion(
  account: Account,
  messageId: string
): Promise<void> {
  const senderSecretKey = getSecretFromNsec(account.nostr.deviceNsec ?? '')
  const wraps = getMessageWraps(account.id, messageId)
  if (!senderSecretKey || wraps.length === 0) {
    return
  }
  const nostrApi = new NostrAPI(account.nostr.relays)
  try {
    await Promise.allSettled(
      wraps.map((wrap) =>
        nostrApi.publishEvent(
          toNdkEvent(
            createDerivedWrapDeletion(
              senderSecretKey,
              messageId,
              wrap.recipientPubkey,
              [wrap.wrapId]
            )
          )
        )
      )
    )
  } finally {
    nostrApi.closeAllSubscriptions()
  }
}

/**
 * Tells every device to drop one of our messages (a gift-wrapped kind 5
 * rumor), asks relays to drop its wraps, then deletes it here. Throws when
 * no device could be told, so the message stays and the user can retry.
 */
async function deleteDeviceMessageForEveryone(
  accountId: string,
  message: NostrDM
): Promise<{ failedDevices: string[] }> {
  const account = getAccount(accountId)
  const rumor =
    account && isOwnDeviceMessage(account, message)
      ? buildDeviceRumor(
          account,
          nostrKinds.EventDeletion,
          '',
          buildMessageDeletionTags([message.id])
        )
      : null
  if (!account || !rumor || isOptimisticDmId(message.id)) {
    deleteDeviceMessageForMe(accountId, message)
    return { failedDevices: [] }
  }
  const { error, failedDevices } = await deliver(() =>
    sendRumorToDevices(account, rumor)
  )
  if (error && !(error instanceof NostrPartialSendError)) {
    throw error
  }
  await requestDeviceWrapDeletion(account, message.id)
  deleteDeviceMessageForMe(accountId, message)
  return { failedDevices }
}

/**
 * Bulk "delete my messages": asks relays to drop every wrap this device
 * published for them and tombstones them, so a resync can't bring them back.
 */
async function deleteOwnDeviceMessagesFromRelays(
  account: Account,
  messages: NostrDM[]
): Promise<void> {
  await Promise.allSettled(
    messages.map((message) => requestDeviceWrapDeletion(account, message.id))
  )
  forgetDeviceMessages(
    account.id,
    messages.map((message) => ({
      author: message.author,
      messageId: message.id
    }))
  )
}

/**
 * Only the author can delete a message: each target is dropped when the
 * requesting device wrote it, and remembered as deleted by that device so a
 * message that arrives after its deletion request is dropped too.
 */
function applyDeviceDeletionRumor(
  accountId: string,
  rumor: NostrUnwrappedEvent
): void {
  const account = getAccount(accountId)
  if (!account?.nostr) {
    return
  }
  const stored = new Map(account.nostr.dms.map((dm) => [dm.id, dm]))
  const tombstones = getDeletionTargetIds(rumor.tags)
    .filter((messageId) => {
      const message = stored.get(messageId)
      return !message || samePubkey(message.author, rumor.pubkey)
    })
    .map((messageId) => ({ author: rumor.pubkey, messageId }))
  forgetDeviceMessages(accountId, tombstones)
}

export {
  applyDeviceDeletionRumor,
  deleteOwnDeviceMessagesFromRelays,
  deleteDeviceMessageForEveryone,
  deleteDeviceMessageForMe,
  isOwnDeviceMessage,
  retryDeviceChatMessage,
  sendDeviceChatMessage
}
export type { DeviceChatSendOutcome }
