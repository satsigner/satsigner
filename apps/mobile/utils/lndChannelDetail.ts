import { type LNDChannel } from '@/types/models/LND'

/**
 * LND grpc-gateway JSON uses lowerCamelCase; some layers use snake_case.
 * Read the first present non-empty string among {@link keys}.
 */
export function readLndChannelStringField(
  channel: unknown,
  keys: readonly string[]
): string {
  if (!channel || typeof channel !== 'object') {
    return ''
  }
  const c = channel as Record<string, unknown>
  for (const key of keys) {
    if (!Object.hasOwn(c, key)) {
      continue
    }
    const v = c[key]
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim()
    }
  }
  return ''
}

export function getLndChannelPeerAlias(channel: unknown): string {
  return readLndChannelStringField(channel, ['peer_alias', 'peerAlias'])
}

export function getLndChannelRemotePubkey(channel: unknown): string {
  return readLndChannelStringField(channel, ['remote_pubkey', 'remotePubkey'])
}

/** LND often returns uint64 channel fields as decimal strings in JSON. */
export function parseLndSats(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return 0
    }
    const n = Number(trimmed)
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
  }
  return 0
}

/** First matching key wins; values parsed with {@link parseLndSats}. */
export function readLndChannelSatsField(
  channel: unknown,
  keys: readonly string[]
): number {
  if (!channel || typeof channel !== 'object') {
    return 0
  }
  const c = channel as Record<string, unknown>
  for (const key of keys) {
    if (!Object.hasOwn(c, key)) {
      continue
    }
    const raw = c[key]
    if (raw === undefined || raw === null) {
      continue
    }
    return parseLndSats(raw)
  }
  return 0
}

/** Flex parts for a 3-segment row; sum is at most this value. */
export const LIQUIDITY_BAR_PART_COUNT = 1000

const MIN_LIQUIDITY_FLEX_WHEN_NONZERO = 1

/**
 * Distributes bar flex between local / remote / remainder so non-zero
 * balances always get at least one flex part (visible sliver) and the three
 * parts sum to {@link LIQUIDITY_BAR_PART_COUNT} when possible.
 */
export function liquidityBarSegmentFlexParts(
  nodeTotal: number,
  localSats: number,
  remoteSats: number
): { black: number; local: number; remote: number } {
  if (nodeTotal <= 0) {
    return { black: 0, local: 0, remote: 0 }
  }

  let rLocal = Math.round((LIQUIDITY_BAR_PART_COUNT * localSats) / nodeTotal)
  let rRemote = Math.round((LIQUIDITY_BAR_PART_COUNT * remoteSats) / nodeTotal)

  if (localSats > 0) {
    rLocal = Math.max(MIN_LIQUIDITY_FLEX_WHEN_NONZERO, rLocal)
  }
  if (remoteSats > 0) {
    rRemote = Math.max(MIN_LIQUIDITY_FLEX_WHEN_NONZERO, rRemote)
  }

  let rBlack = LIQUIDITY_BAR_PART_COUNT - rLocal - rRemote
  while (rBlack < 0) {
    if (rLocal > MIN_LIQUIDITY_FLEX_WHEN_NONZERO && rLocal >= rRemote) {
      rLocal -= 1
    } else if (rRemote > MIN_LIQUIDITY_FLEX_WHEN_NONZERO) {
      rRemote -= 1
    } else if (rLocal > MIN_LIQUIDITY_FLEX_WHEN_NONZERO) {
      rLocal -= 1
    } else {
      break
    }
    rBlack = LIQUIDITY_BAR_PART_COUNT - rLocal - rRemote
  }

  return {
    black: Math.max(0, rBlack),
    local: localSats > 0 ? rLocal : 0,
    remote: remoteSats > 0 ? rRemote : 0
  }
}

export function formatLndChannelDetailValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

/** Parses LND `channel_point` (`fundingTxid:vout`) for REST path segments. */
export function parseLndChannelPoint(channelPoint: string): {
  txid: string
  vout: string
} | null {
  const trimmed = channelPoint.trim()
  if (!trimmed) {
    return null
  }
  const colon = trimmed.lastIndexOf(':')
  if (colon <= 0 || colon >= trimmed.length - 1) {
    return null
  }
  const txid = trimmed.slice(0, colon)
  const vout = trimmed.slice(colon + 1)
  if (!/^\d+$/.test(vout)) {
    return null
  }
  if (!/^[0-9a-fA-F]+$/.test(txid)) {
    return null
  }
  return { txid, vout }
}

export function findChannelByChanId(
  channels: LNDChannel[] | undefined,
  chanId: string
): LNDChannel | undefined {
  if (!channels?.length) {
    return undefined
  }
  return channels.find((ch) => {
    const id = readLndChannelStringField(ch, ['chan_id', 'chanId'])
    return id === chanId
  })
}
