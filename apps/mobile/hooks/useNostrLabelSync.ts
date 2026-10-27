import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_BACKUP_FINGERPRINT_LENGTH,
  NOSTR_LABELS_MAX_CHUNK_BYTES
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import type { Label } from '@/types/bips/329'
import type { Account } from '@/types/models/Account'
import { formatAccountLabels, labelsToJSONL } from '@/utils/bip329'
import { sha256 } from '@/utils/crypto'
import { NostrPartialSendError } from '@/utils/errors'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'

// Bitcoin Safe v1.7.1 imports labels with Label.from_dump(), which asserts
// __class__ == "Label" and requires VERSION and a timestamp.
const LABEL_WIRE_VERSION = '0.0.3'
const LABEL_WIRE_CLASS = 'Label'

function getLabelTimestamp(label: Label, nowSec: number): number {
  if (typeof label.time === 'number') {
    return label.time
  }
  if (label.time instanceof Date) {
    return label.time.getTime() / MS_PER_SECOND
  }
  return nowSec
}

function toWireEntry(label: Label, timestamp: number): Record<string, unknown> {
  return {
    VERSION: LABEL_WIRE_VERSION,
    __class__: LABEL_WIRE_CLASS,
    label: label.label,
    ref: label.ref,
    timestamp,
    type: label.type,
    ...(label.spendable !== undefined && { spendable: label.spendable })
  }
}

/** Splits JSONL lines into chunks that stay under the NIP-44 size limit. */
function chunkLines(lines: string[], maxBytes: number): string[] {
  const buckets: string[][] = []
  const size = { current: 0 }
  for (const line of lines) {
    const current = buckets.at(-1)
    const lineSize = line.length + 1
    if (current && size.current + lineSize <= maxBytes) {
      current.push(line)
      size.current += lineSize
      continue
    }
    buckets.push([line])
    size.current = lineSize
  }
  return buckets.map((bucket) => bucket.join('\n'))
}

/**
 * An incremental update sends only the changed label (stamped now), matching
 * Bitcoin Safe's on_labels_updated; a full sync sends every label in chunks.
 */
function buildLabelChunks(labels: Label[], singleLabel?: Label): string[] {
  const nowSec = Date.now() / MS_PER_SECOND
  if (singleLabel) {
    return [JSON.stringify(toWireEntry(singleLabel, nowSec))]
  }
  const lines = labels.map((label) =>
    JSON.stringify(toWireEntry(label, getLabelTimestamp(label, nowSec)))
  )
  return chunkLines(lines, NOSTR_LABELS_MAX_CHUNK_BYTES)
}

function buildLabelMessage(jsonl: string): string {
  return JSON.stringify({
    created_at: Math.floor(Date.now() / MS_PER_SECOND),
    data: { data: jsonl, data_type: 'LabelsBip329' },
    description: '',
    label: 1
  })
}

async function publishLabelChunks(
  account: Account,
  chunks: string[]
): Promise<void> {
  const { deviceNsec, relays } = account.nostr
  const trustedDevices =
    useAccountsStore.getState().accounts.find((a) => a.id === account.id)?.nostr
      ?.trustedMemberDevices ?? []
  if (trustedDevices.length === 0 || !deviceNsec) {
    return
  }

  const nostrApi = new NostrAPI(relays)
  try {
    await publishToTrustedDevices(nostrApi, deviceNsec, trustedDevices, chunks)
  } finally {
    nostrApi.closeAllSubscriptions()
  }
}

async function publishToTrustedDevices(
  nostrApi: NostrAPI,
  deviceNsec: string,
  trustedDevices: string[],
  chunks: string[]
): Promise<void> {
  await nostrApi.connectForPublish()
  const sends = trustedDevices.flatMap((deviceNpub) =>
    chunks.map((jsonl) => ({ deviceNpub, jsonl }))
  )
  const results = await Promise.allSettled(
    sends.map(({ deviceNpub, jsonl }) =>
      nostrApi.publishEvent(
        nostrApi.createKind1059(
          deviceNsec,
          deviceNpub,
          buildLabelMessage(jsonl)
        )
      )
    )
  )
  const failedDevices = new Set(
    sends
      .filter((_send, index) => results[index].status === 'rejected')
      .map((send) => send.deviceNpub)
  )
  if (failedDevices.size > 0) {
    const delivered = trustedDevices.filter((npub) => !failedDevices.has(npub))
    throw new NostrPartialSendError(delivered, [...failedDevices])
  }
}

async function syncLabelsToNostr(account?: Account, singleLabel?: Label) {
  if (!account?.nostr?.autoSync) {
    return
  }
  const { commonNsec, commonNpub, relays, deviceNpub, deviceNsec } =
    account.nostr
  if (
    !commonNsec ||
    !commonNpub ||
    relays.length === 0 ||
    !deviceNpub ||
    !deviceNsec
  ) {
    return
  }

  // The account passed in already has the new label applied by the store.
  const labels = formatAccountLabels(account)
  const hash = await sha256(labelsToJSONL(labels))
  const fingerprint = hash.slice(0, NOSTR_BACKUP_FINGERPRINT_LENGTH)
  if (!singleLabel && fingerprint === account.nostr.lastBackupFingerprint) {
    return
  }
  if (labels.length === 0) {
    toast.error(t('account.nostrSync.noLabels'))
    return
  }

  try {
    await publishLabelChunks(account, buildLabelChunks(labels, singleLabel))
    if (!singleLabel) {
      useAccountsStore
        .getState()
        .updateAccountNostr(account.id, { lastBackupFingerprint: fingerprint })
    }
  } catch (error) {
    toast.error(t('account.nostrSync.labelSyncFailed'), {
      description: getNostrErrorMessage(error)
    })
  }
}

function useNostrLabelSync() {
  return { sync: syncLabelsToNostr }
}

export { buildLabelChunks, syncLabelsToNostr, useNostrLabelSync }
