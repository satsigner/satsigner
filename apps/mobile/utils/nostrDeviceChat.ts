import { MS_PER_SECOND } from '@/constants/time'
import {
  type NostrDeviceSendResult,
  sendDeviceDM
} from '@/hooks/useNostrPublish'
import { useAccountsStore } from '@/store/accounts'
import { type NostrDM } from '@/types/models/Nostr'
import { NostrPartialSendError } from '@/utils/errors'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { createOptimisticDmId } from '@/utils/nostrDms'

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

function buildOptimisticDm(authorHex: string, text: string): NostrDM {
  const createdAt = Math.floor(Date.now() / MS_PER_SECOND)
  return {
    author: authorHex,
    content: { created_at: createdAt, description: text, pubkey: authorHex },
    created_at: createdAt,
    description: text,
    event: '',
    id: createOptimisticDmId(),
    label: 1,
    pending: true
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
  text: string
): Promise<DeviceChatSendOutcome | null> {
  const account = getAccount(accountId)
  const deviceHex = account?.nostr?.deviceNpub
    ? getPubKeyHexFromNpub(account.nostr.deviceNpub)
    : null
  if (!account || !deviceHex) {
    return null
  }
  const optimistic = buildOptimisticDm(deviceHex, text)
  const store = useAccountsStore.getState()
  store.addAccountDms(accountId, [optimistic])

  const result = await deliver(() => sendDeviceDM(account, text))
  store.updateAccountDmStatus(accountId, optimistic.id, { pending: false })
  return { ...result, messageId: optimistic.id }
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
  const result = await deliver(() =>
    sendDeviceDM(account, message.description, { onlyDevices: failedDevices })
  )
  return { ...result, messageId: message.id }
}

export { retryDeviceChatMessage, sendDeviceChatMessage }
export type { DeviceChatSendOutcome }
