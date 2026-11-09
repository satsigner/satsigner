import * as nostrKinds from 'nostr-tools/kinds'

import { NostrAPI } from '@/api/nostr'
import {
  type NostrRumor,
  createChatRumor,
  createDerivedGiftWrap,
  toNdkEvent
} from '@/api/nostrGiftWrap'
import { MS_PER_SECOND } from '@/constants/time'
import {
  type NostrMessageWrap,
  recordMessageWraps
} from '@/db/nostrMessageState'
import { type Account } from '@/types/models/Account'
import { NostrPartialSendError } from '@/utils/errors'
import {
  compressMessage,
  getPubKeyHexFromNpub,
  getSecretFromNsec
} from '@/utils/nostr'
import { buildReplyTag } from '@/utils/nostrChatTags'

type NostrDeviceSendResult = { delivered: string[]; failed: string[] }

type NostrDeviceSendOptions = {
  /** Only send to these device npubs (retry of a partial send). */
  onlyDevices?: string[]
  replyToId?: string
}

const EMPTY_SEND_RESULT: NostrDeviceSendResult = { delivered: [], failed: [] }

/** This device's own copy first, then every trusted member device. */
function getRecipientDevices(account: Account): string[] {
  const { deviceNpub, trustedMemberDevices } = account.nostr
  const others = (trustedMemberDevices || []).filter(
    (npub) => npub !== deviceNpub
  )
  return deviceNpub ? [deviceNpub, ...others] : others
}

function canSendToDevices(account: Account): boolean {
  const { autoSync, deviceNsec, relays } = account.nostr ?? {}
  return !!autoSync && !!deviceNsec && !!relays?.length
}

/**
 * One rumor addressed to every device (a `p` tag each), so all devices store
 * the message under the same id: replies and deletions can then point at it.
 */
function buildDeviceRumor(
  account: Account,
  kind: number,
  content: string,
  extraTags: string[][] = []
): NostrRumor | null {
  const senderSecretKey = getSecretFromNsec(account.nostr?.deviceNsec ?? '')
  if (!senderSecretKey) {
    return null
  }
  const recipientTags = getRecipientDevices(account)
    .map(getPubKeyHexFromNpub)
    .filter((hex) => hex !== null)
    .map((hex) => ['p', hex])
  return createChatRumor({
    content,
    kind,
    senderSecretKey,
    tags: [...recipientTags, ...extraTags]
  })
}

async function publishWrap(
  nostrApi: NostrAPI,
  rumor: NostrRumor,
  senderSecretKey: Uint8Array,
  recipientNpub: string
): Promise<NostrMessageWrap> {
  const recipientPubkey = getPubKeyHexFromNpub(recipientNpub)
  if (recipientPubkey === null) {
    throw new Error('Invalid recipient npub')
  }
  const wrap = await createDerivedGiftWrap(
    rumor,
    senderSecretKey,
    recipientPubkey
  )
  await nostrApi.publishEvent(toNdkEvent(wrap))
  return { recipientPubkey, wrapId: wrap.id }
}

async function publishToDevices(
  nostrApi: NostrAPI,
  account: Account,
  rumor: NostrRumor,
  recipients: string[]
): Promise<NostrDeviceSendResult> {
  const senderSecretKey = getSecretFromNsec(account.nostr.deviceNsec ?? '')
  if (!senderSecretKey) {
    throw new NostrPartialSendError([], recipients)
  }
  try {
    await nostrApi.connect()
  } catch (error) {
    throw new NostrPartialSendError([], recipients, { cause: error })
  }

  const results = await Promise.allSettled(
    recipients.map((npub) =>
      publishWrap(nostrApi, rumor, senderSecretKey, npub)
    )
  )
  recordMessageWraps(
    account.id,
    rumor.id,
    results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    )
  )
  const delivered = recipients.filter(
    (_npub, index) => results[index].status === 'fulfilled'
  )
  const failed = recipients.filter(
    (_npub, index) => results[index].status === 'rejected'
  )
  if (failed.length > 0) {
    const firstFailure = results.find((result) => result.status === 'rejected')
    throw new NostrPartialSendError(delivered, failed, {
      cause: firstFailure?.status === 'rejected' ? firstFailure.reason : null
    })
  }
  return { delivered, failed }
}

/**
 * Publishes one gift-wrapped rumor to every recipient device in parallel.
 * Resolves with the per-device result when all were delivered and throws
 * NostrPartialSendError listing delivered and failed devices otherwise, so
 * a retry can re-send the same rumor to only the failed ones.
 */
async function sendRumorToDevices(
  account: Account,
  rumor: NostrRumor,
  onlyDevices?: string[]
): Promise<NostrDeviceSendResult> {
  if (!canSendToDevices(account)) {
    return EMPTY_SEND_RESULT
  }
  const recipients = onlyDevices ?? getRecipientDevices(account)
  if (recipients.length === 0) {
    return EMPTY_SEND_RESULT
  }
  const nostrApi = new NostrAPI(account.nostr.relays)
  try {
    return await publishToDevices(nostrApi, account, rumor, recipients)
  } finally {
    nostrApi.closeAllSubscriptions()
  }
}

function buildPayloadRumor(
  account: Account,
  payload: Record<string, unknown>,
  replyToId?: string
): NostrRumor | null {
  return buildDeviceRumor(
    account,
    nostrKinds.PrivateDirectMessage,
    compressMessage(payload),
    replyToId ? [buildReplyTag(replyToId)] : []
  )
}

function sendPayloadToDevices(
  account: Account,
  payload: Record<string, unknown>,
  options: NostrDeviceSendOptions = {}
): Promise<NostrDeviceSendResult> {
  if (!canSendToDevices(account)) {
    return Promise.resolve(EMPTY_SEND_RESULT)
  }
  const rumor = buildPayloadRumor(account, payload, options.replyToId)
  if (!rumor) {
    return Promise.resolve(EMPTY_SEND_RESULT)
  }
  return sendRumorToDevices(account, rumor, options.onlyDevices)
}

function nowInSeconds(): number {
  return Math.floor(Date.now() / MS_PER_SECOND)
}

function buildDmPayload(message: string): Record<string, unknown> {
  return { created_at: nowInSeconds(), description: message }
}

function sendDeviceDM(
  account: Account,
  message: string,
  options?: NostrDeviceSendOptions
): Promise<NostrDeviceSendResult> {
  return sendPayloadToDevices(account, buildDmPayload(message), options)
}

function sendDevicePSBT(
  account: Account,
  psbt: string,
  options?: NostrDeviceSendOptions
): Promise<NostrDeviceSendResult> {
  return sendPayloadToDevices(
    account,
    {
      created_at: nowInSeconds(),
      data: { data: psbt, data_type: 'PSBT' },
      description: 'PSBT for signing'
    },
    options
  )
}

function useNostrPublish() {
  return { sendDM: sendDeviceDM, sendPSBT: sendDevicePSBT }
}

export {
  buildDeviceRumor,
  buildDmPayload,
  buildPayloadRumor,
  canSendToDevices,
  getRecipientDevices,
  sendDeviceDM,
  sendDevicePSBT,
  sendRumorToDevices
}
export type { NostrDeviceSendOptions, NostrDeviceSendResult }
export default useNostrPublish
