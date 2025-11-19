import { decode } from '@gandlaf21/bolt11-decode'

import { type DecodedInvoice } from '@/types/lightning'

type Bolt11Section = {
  name: string
  value: string | number
}

type Bolt11Decoded = {
  sections: Bolt11Section[]
  route_hints?: unknown[]
}

function mapBolt11DecodeToDecodedInvoice(
  bolt11Decoded: Bolt11Decoded,
  originalInvoice: string
): DecodedInvoice {
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

  const amountValue = amountSection?.value || '0'
  const numMsats = parseInt(amountValue.toString(), 10)
  const numSatoshis = Math.ceil(numMsats / 1000).toString()

  return {
    payment_request: originalInvoice,
    value: numSatoshis,
    description: (descriptionSection?.value || '').toString(),
    timestamp: (timestampSection?.value || '').toString(),
    expiry: (expirySection?.value || '').toString(),
    payment_hash: (paymentHashSection?.value || '').toString(),
    payment_addr: '',
    num_satoshis: numSatoshis,
    num_msat: numMsats.toString(),
    features: {},
    route_hints: bolt11Decoded.route_hints || [],
    payment_secret: (paymentSecretSection?.value || '').toString(),
    min_final_cltv_expiry: (minFinalCltvExpirySection?.value || '').toString()
  }
}

export function decodeLightningInvoice(invoice: string): DecodedInvoice {
  try {
    const bolt11Decoded = decode(invoice)
    return mapBolt11DecodeToDecodedInvoice(bolt11Decoded, invoice)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to decode Lightning invoice: ${message}`)
  }
}

export function isLightningInvoice(invoice: string): boolean {
  if (!invoice || typeof invoice !== 'string') return false

  const trimmed = invoice.trim()
  return (
    trimmed.toLowerCase().startsWith('lnbc') ||
    trimmed.toLowerCase().startsWith('lntb') ||
    trimmed.toLowerCase().startsWith('lnbcrt')
  )
}
