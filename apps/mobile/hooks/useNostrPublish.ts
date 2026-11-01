import { NostrAPI } from '@/api/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { type Account } from '@/types/models/Account'
import { NostrPartialSendError } from '@/utils/errors'
import { compressMessage } from '@/utils/nostr'

type NostrDeviceSendResult = { delivered: string[]; failed: string[] }

type NostrDeviceSendOptions = {
  /** Only send to these device npubs (retry of a partial send). */
  onlyDevices?: string[]
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

/**
 * Publishes one gift-wrapped payload to every recipient device in parallel.
 * Resolves with the per-device result when all were delivered and throws
 * NostrPartialSendError listing delivered and failed devices otherwise, so
 * a retry can target only the failed ones.
 */
async function sendToDevices(
  account: Account,
  payload: Record<string, unknown>,
  options: NostrDeviceSendOptions = {}
): Promise<NostrDeviceSendResult> {
  const { autoSync, deviceNsec, relays } = account.nostr ?? {}
  if (!autoSync || !deviceNsec || !relays?.length) {
    return EMPTY_SEND_RESULT
  }
  const recipients = options.onlyDevices ?? getRecipientDevices(account)
  if (recipients.length === 0) {
    return EMPTY_SEND_RESULT
  }

  const content = compressMessage(payload)
  const nostrApi = new NostrAPI(relays)
  try {
    return await publishToDevices(nostrApi, deviceNsec, recipients, content)
  } finally {
    nostrApi.closeAllSubscriptions()
  }
}

async function publishToDevices(
  nostrApi: NostrAPI,
  deviceNsec: string,
  recipients: string[],
  content: string
): Promise<NostrDeviceSendResult> {
  try {
    await nostrApi.connect()
  } catch (error) {
    throw new NostrPartialSendError([], recipients, { cause: error })
  }

  const results = await Promise.allSettled(
    recipients.map(async (npub) => {
      const event = nostrApi.createKind1059(deviceNsec, npub, content)
      await nostrApi.publishEvent(event)
    })
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

function sendDeviceDM(
  account: Account,
  message: string,
  options?: NostrDeviceSendOptions
): Promise<NostrDeviceSendResult> {
  return sendToDevices(
    account,
    {
      created_at: Math.floor(Date.now() / MS_PER_SECOND),
      description: message
    },
    options
  )
}

function sendDevicePSBT(
  account: Account,
  psbt: string,
  options?: NostrDeviceSendOptions
): Promise<NostrDeviceSendResult> {
  return sendToDevices(
    account,
    {
      created_at: Math.floor(Date.now() / MS_PER_SECOND),
      data: { data: psbt, data_type: 'PSBT' },
      description: 'PSBT for signing'
    },
    options
  )
}

function useNostrPublish() {
  return { sendDM: sendDeviceDM, sendPSBT: sendDevicePSBT }
}

export { sendDeviceDM, sendDevicePSBT }
export type { NostrDeviceSendOptions, NostrDeviceSendResult }
export default useNostrPublish
