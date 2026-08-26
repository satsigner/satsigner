import {
  LND_NODE_PUBKEY_HEX_LENGTH,
  LND_OPEN_CHANNEL_MAX_MIN_CONFS,
  LND_OPEN_CHANNEL_MIN_FUNDING_SAT
} from '@/constants/lightning'
import type {
  LNDOpenChannelRequest,
  LNDRestPeer
} from '@/types/models/Lightning'
import { getLndErrorMessage } from '@/utils/lndHttpError'

const PUBKEY_HEX_REGEX = new RegExp(
  `^[0-9a-fA-F]{${LND_NODE_PUBKEY_HEX_LENGTH}}$`
)
const ALREADY_CONNECTED_PATTERN = /already connected/i

export type ParsedLndPeer = {
  host?: string
  pubkey: string
}

export type LndOpenChannelFunding = {
  localFundingSat: number
  minConfs: number
  privateChannel: boolean
  pushSat: number
  satPerVbyte?: number
}

export type LndOpenChannelValidationReason =
  | 'amount'
  | 'balance'
  | 'fee'
  | 'minConfs'
  | 'peer'
  | 'push'

export type LndOpenChannelValidation =
  | { ok: true; peer: ParsedLndPeer }
  | { ok: false; reason: LndOpenChannelValidationReason }

const LIGHTNING_URI_PREFIX = /^(lightning:|ln:\/\/)/i

export function parseLndPeerUri(input: string): ParsedLndPeer | null {
  const trimmed = input.trim().replace(LIGHTNING_URI_PREFIX, '').trim()
  if (!trimmed) {
    return null
  }

  const atIndex = trimmed.indexOf('@')
  if (atIndex === -1) {
    if (!PUBKEY_HEX_REGEX.test(trimmed)) {
      return null
    }
    return { pubkey: trimmed }
  }

  const pubkey = trimmed.slice(0, atIndex)
  const host = trimmed.slice(atIndex + 1).trim()
  if (!PUBKEY_HEX_REGEX.test(pubkey) || !host) {
    return null
  }
  return { host, pubkey }
}

export function formatParsedLndPeer(peer: ParsedLndPeer): string {
  if (peer.host) {
    return `${peer.pubkey}@${peer.host}`
  }
  return peer.pubkey
}

export function peerUriFromScannedText(input: string): string | null {
  const parsed = parseLndPeerUri(input)
  if (!parsed) {
    return null
  }
  return formatParsedLndPeer(parsed)
}

export function formatLndPeerUri(peer: LNDRestPeer): string {
  const pubkey = peer.pub_key ?? ''
  const address = peer.address ?? ''
  if (pubkey && address) {
    return `${pubkey}@${address}`
  }
  return pubkey
}

export function isLndAlreadyConnectedError(error: unknown): boolean {
  return ALREADY_CONNECTED_PATTERN.test(getLndErrorMessage(error))
}

export function buildLndOpenChannelBody(
  pubkey: string,
  funding: LndOpenChannelFunding
): LNDOpenChannelRequest {
  const body: LNDOpenChannelRequest = {
    local_funding_amount: String(funding.localFundingSat),
    min_confs: funding.minConfs,
    node_pubkey_string: pubkey,
    private: funding.privateChannel,
    push_sat: String(funding.pushSat)
  }
  if (funding.satPerVbyte !== undefined) {
    body.sat_per_vbyte = String(funding.satPerVbyte)
  }
  return body
}

export function validateLndOpenChannelInput(input: {
  confirmedSat: number
  localFundingSat: number
  minConfs: number
  peerText: string
  pushSat: number
  satPerVbyteText: string
}): LndOpenChannelValidation {
  const peer = parseLndPeerUri(input.peerText)
  if (!peer) {
    return { ok: false, reason: 'peer' }
  }
  if (
    !Number.isInteger(input.minConfs) ||
    input.minConfs < 0 ||
    input.minConfs > LND_OPEN_CHANNEL_MAX_MIN_CONFS
  ) {
    return { ok: false, reason: 'minConfs' }
  }
  const feeText = input.satPerVbyteText.trim()
  if (feeText) {
    const fee = Number(feeText)
    if (!Number.isInteger(fee) || fee < 1) {
      return { ok: false, reason: 'fee' }
    }
  }
  if (
    !Number.isInteger(input.localFundingSat) ||
    input.localFundingSat < LND_OPEN_CHANNEL_MIN_FUNDING_SAT
  ) {
    return { ok: false, reason: 'amount' }
  }
  if (input.localFundingSat > input.confirmedSat) {
    return { ok: false, reason: 'balance' }
  }
  if (
    !Number.isInteger(input.pushSat) ||
    input.pushSat < 0 ||
    input.pushSat > input.localFundingSat
  ) {
    return { ok: false, reason: 'push' }
  }
  return { ok: true, peer }
}

export function parseOptionalSatPerVbyte(
  satPerVbyteText: string
): number | undefined {
  const feeText = satPerVbyteText.trim()
  if (!feeText) {
    return undefined
  }
  return Number(feeText)
}

export async function openChannelWithPeer(
  peer: ParsedLndPeer,
  funding: LndOpenChannelFunding,
  deps: {
    connectPeer: (input: { host: string; pubkey: string }) => Promise<unknown>
    openChannel: (body: LNDOpenChannelRequest) => Promise<unknown>
  }
): Promise<unknown> {
  if (peer.host) {
    try {
      await deps.connectPeer({ host: peer.host, pubkey: peer.pubkey })
    } catch (error) {
      if (!isLndAlreadyConnectedError(error)) {
        throw error
      }
    }
  }
  return deps.openChannel(buildLndOpenChannelBody(peer.pubkey, funding))
}
