import { decode } from '@gandlaf21/bolt11-decode'

import { MILLISATS_PER_SAT } from '@/constants/btc'
import type {
  Bolt11Decoded,
  Bolt11Section,
  LNDDecodedInvoice
} from '@/types/models/Lightning'

function mapBolt11DecodeToDecodedInvoice(
  bolt11Decoded: Bolt11Decoded,
  originalInvoice: string
) {
  const amountSection = bolt11Decoded.sections.find(
    (s: Bolt11Section) => s.name === 'amount'
  )
  const descriptionSection = bolt11Decoded.sections.find(
    (s: Bolt11Section) => s.name === 'description'
  )
  const expirySection = bolt11Decoded.sections.find(
    (s: Bolt11Section) => s.name === 'expiry'
  )
  const paymentHashSection = bolt11Decoded.sections.find(
    (s: Bolt11Section) => s.name === 'payment_hash'
  )
  const timestampSection = bolt11Decoded.sections.find(
    (s: Bolt11Section) => s.name === 'timestamp'
  )
  const paymentSecretSection = bolt11Decoded.sections.find(
    (s: Bolt11Section) => s.name === 'payment_secret'
  )
  const minFinalCltvExpirySection = bolt11Decoded.sections.find(
    (s: Bolt11Section) => s.name === 'min_final_cltv_expiry'
  )

  const amountValue = amountSection?.value
  const parsedMsats = amountValue ? parseInt(amountValue.toString(), 10) : 0
  const numMsats =
    Number.isNaN(parsedMsats) || parsedMsats <= 0 ? 0 : parsedMsats
  const numSatoshis =
    numMsats <= 0 ? '0' : Math.ceil(numMsats / MILLISATS_PER_SAT).toString()

  return {
    description: (descriptionSection?.value || '').toString(),
    expiry: (expirySection?.value || '').toString(),
    features: {},
    min_final_cltv_expiry: (minFinalCltvExpirySection?.value || '').toString(),
    num_msat: numMsats.toString(),
    num_satoshis: numSatoshis,
    payment_addr: '',
    payment_hash: (paymentHashSection?.value || '').toString(),
    payment_request: originalInvoice,
    payment_secret: (paymentSecretSection?.value || '').toString(),
    route_hints: bolt11Decoded.route_hints || [],
    timestamp: (timestampSection?.value || '').toString(),
    value: numSatoshis
  }
}

export function bolt11AmountSats(invoice: {
  num_msat?: string
  num_satoshis?: string
  value?: string
}) {
  const fromSatField = parseInt(invoice.num_satoshis ?? '', 10)
  if (!Number.isNaN(fromSatField) && fromSatField > 0) {
    return fromSatField
  }
  const msat = parseInt(invoice.num_msat ?? '', 10)
  if (!Number.isNaN(msat) && msat > 0) {
    return Math.ceil(msat / MILLISATS_PER_SAT)
  }
  const fromValue = parseInt(invoice.value ?? '', 10)
  if (!Number.isNaN(fromValue) && fromValue > 0) {
    return fromValue
  }
  return 0
}

export function isAmountlessBolt11Invoice(invoice: {
  num_msat?: string
  num_satoshis?: string
  value?: string
}) {
  return bolt11AmountSats(invoice) === 0
}

export function decodeLightningInvoice(invoice: string): LNDDecodedInvoice {
  const bolt11Decoded = decode(invoice)
  return mapBolt11DecodeToDecodedInvoice(bolt11Decoded, invoice)
}

export function isLightningInvoice(invoice: string) {
  if (!invoice || typeof invoice !== 'string') {
    return false
  }

  const trimmed = invoice.trim()
  return (
    trimmed.toLowerCase().startsWith('lnbc') ||
    trimmed.toLowerCase().startsWith('lntb') ||
    trimmed.toLowerCase().startsWith('lnbcrt')
  )
}
