import { DUST_LIMIT } from '@/constants/btc'
import {
  LND_NEW_ADDRESS_TYPE_UNUSED_WITNESS_PUBKEY_HASH,
  LND_NEW_ADDRESS_TYPE_WITNESS_PUBKEY_HASH,
  LND_OPEN_CHANNEL_MAX_SAT_PER_VBYTE
} from '@/constants/lightning'
import type { LNDSendCoinsRequest } from '@/types/models/Lightning'
import { parseBitcoinUri } from '@/utils/bip321'
import { isBitcoinAddress } from '@/utils/bitcoin'
import { parseOptionalSatPerVbyte } from '@/utils/lndOpenChannel'

export type LndOnchainSendValidationReason =
  | 'address'
  | 'amount'
  | 'balance'
  | 'fee'

export type LndOnchainSendValidation =
  | { amountSat: number; ok: true; satPerVbyte?: number }
  | { ok: false; reason: LndOnchainSendValidationReason }

export function buildNewAddressPath(fresh = false): string {
  const type = fresh
    ? LND_NEW_ADDRESS_TYPE_WITNESS_PUBKEY_HASH
    : LND_NEW_ADDRESS_TYPE_UNUSED_WITNESS_PUBKEY_HASH
  return `/v1/newaddress?type=${type}`
}

export function buildSendCoinsBody(input: {
  addr: string
  amountSat: number
  satPerVbyte?: number
}): LNDSendCoinsRequest {
  const body: LNDSendCoinsRequest = {
    addr: input.addr,
    amount: String(input.amountSat)
  }
  if (input.satPerVbyte !== undefined) {
    body.sat_per_vbyte = String(input.satPerVbyte)
  }
  return body
}

export function parseBitcoinUriAddress(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.toLowerCase().startsWith('bitcoin:')) {
    const parsed = parseBitcoinUri(trimmed)
    if (parsed.isValid && isBitcoinAddress(parsed.address)) {
      return parsed.address
    }
    return null
  }
  if (isBitcoinAddress(trimmed)) {
    return trimmed
  }
  return null
}

export function validateLndOnchainSend(input: {
  address: string
  amountText: string
  confirmedBalanceSat: number
  satPerVbyteText: string
}): LndOnchainSendValidation {
  const addr = parseBitcoinUriAddress(input.address)
  if (!addr) {
    return { ok: false, reason: 'address' }
  }
  const feeText = input.satPerVbyteText.trim()
  if (feeText) {
    const fee = Number(feeText)
    if (
      !Number.isInteger(fee) ||
      fee < 1 ||
      fee > LND_OPEN_CHANNEL_MAX_SAT_PER_VBYTE
    ) {
      return { ok: false, reason: 'fee' }
    }
  }
  const amountSat = Number(input.amountText)
  if (
    !Number.isInteger(amountSat) ||
    amountSat < DUST_LIMIT ||
    amountSat <= 0
  ) {
    return { ok: false, reason: 'amount' }
  }
  if (amountSat > input.confirmedBalanceSat) {
    return { ok: false, reason: 'balance' }
  }
  return {
    amountSat,
    ok: true,
    satPerVbyte: parseOptionalSatPerVbyte(input.satPerVbyteText)
  }
}
