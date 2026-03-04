import { useCallback, useMemo } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { formatAccountLabels, type Label, labelsToJSONL } from '@/utils/bip329'
import { sha256 } from '@/utils/crypto'

function useNostrLabelSync() {
  const sync = useCallback(async (account?: Account, singleLabel?: Label) => {
    if (!account || !account.nostr || !account.nostr.autoSync) return

    const { commonNsec, commonNpub, relays, deviceNpub, deviceNsec } =
      account.nostr

    if (
      !commonNsec ||
      commonNpub === '' ||
      relays.length === 0 ||
      !deviceNpub ||
      !deviceNsec
    ) {
      return
    }

    // The account passed in is always the updated account (store has already
    // applied the new label), so formatAccountLabels includes the latest label.
    const labels: Label[] = formatAccountLabels(account)

    // Always check fingerprint for both single and bulk cases
    const message = labelsToJSONL(labels)
    const hash = await sha256(message)
    const fingerprint = hash.slice(0, 8)

    // Only skip if it's not a single label and fingerprint matches
    if (!singleLabel && fingerprint === account.nostr.lastBackupFingerprint) {
      return
    }

    if (labels.length === 0) {
      toast.error(t('account.nostrSync.errorMissingData'))
      return
    }

    // NIP-44 encrypts at most 65535 bytes. Bitcoin Safe chunks at 60 000 chars.
    // When a singleLabel is provided (incremental update), send only that label
    // — matching Bitcoin Safe's on_labels_updated which only sends changed refs.
    // For full syncs, chunk all labels at MAX_CHUNK_BYTES per message.
    const MAX_CHUNK_BYTES = 60_000
    const nowTimestamp = Date.now() / 1000

    // Build the wire-format entry for a label.
    // Bitcoin Safe v1.7.1 calls import_dumps_data() → Label.from_dump() which
    // asserts dct["__class__"] == "Label" and requires VERSION + timestamp.
    const toEntry = (
      label: Label,
      forceCurrentTime: boolean
    ): Record<string, unknown> => {
      const timestamp = forceCurrentTime
        ? nowTimestamp
        : typeof label.time === 'number'
          ? label.time
          : label.time instanceof Date
            ? label.time.getTime() / 1000
            : nowTimestamp
      const entry: Record<string, unknown> = {
        __class__: 'Label',
        VERSION: '0.0.3',
        type: label.type,
        ref: label.ref,
        label: label.label,
        timestamp
      }
      if (label.spendable !== undefined) {
        entry.spendable = label.spendable
      }
      return entry
    }

    // Produce one or more JSONL chunks, each within the NIP-44 size limit.
    let chunks: string[]
    if (singleLabel) {
      // Incremental: only the changed label, stamped with current time.
      chunks = [JSON.stringify(toEntry(singleLabel, true))]
    } else {
      // Full sync: split into ≤60 000-char chunks.
      const lines = labels.map((l) => JSON.stringify(toEntry(l, false)))
      const buckets: string[][] = []
      let current: string[] = []
      let currentLen = 0
      for (const line of lines) {
        if (currentLen + line.length + 1 > MAX_CHUNK_BYTES && current.length) {
          buckets.push(current)
          current = []
          currentLen = 0
        }
        current.push(line)
        currentLen += line.length + 1
      }
      if (current.length) buckets.push(current)
      chunks = buckets.map((b) => b.join('\n'))
    }

    const buildMessage = (jsonl: string) =>
      JSON.stringify({
        created_at: Math.floor(Date.now() / 1000),
        label: 1,
        description: '',
        data: { data: jsonl, data_type: 'LabelsBip329' }
      })

    const nostrApi = new NostrAPI(relays)

    try {
      await nostrApi.connectForPublish()

      const currentAccount = useAccountsStore
        .getState()
        .accounts.find((a) => a.id === account.id)
      const trustedDevices = currentAccount?.nostr?.trustedMemberDevices || []

      if (trustedDevices.length === 0) return

      // Send each chunk to every trusted device in parallel.
      const allPromises = trustedDevices.flatMap((trustedDeviceNpub) =>
        chunks.map(async (jsonl) => {
          const messageContent = buildMessage(jsonl)
          const eventKind1059 = await nostrApi.createKind1059(
            deviceNsec,
            trustedDeviceNpub,
            messageContent
          )
          return nostrApi.publishEvent(eventKind1059)
        })
      )

      await Promise.allSettled(allPromises)
    } catch {
      // Publish failures are silent fire-and-forget
    }
  }, [])

  return useMemo(() => ({ sync }), [sync])
}

export { useNostrLabelSync }
export default useNostrLabelSync
