import { decode } from 'bitcoin-decoder'

import type {
  ArkDestinationDraft,
  ArkDestinationParseResult,
  ArkSendKind
} from '@/types/models/Ark'

export async function parseArkDestination(
  raw: string
): Promise<ArkDestinationParseResult> {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return { ok: false, reason: 'invalid' }
  }

  const decoded = await decode(trimmed)
  if (!decoded.valid) {
    return { ok: false, reason: 'invalid' }
  }
  if (decoded.kind !== 'payment') {
    return { ok: false, reason: 'unsupported' }
  }

  const { destination, metadata } = decoded

  switch (destination.type) {
    case 'ark-address':
      return {
        draft: { address: destination.value, kind: 'arkoor' },
        ok: true
      }
    case 'bolt11':
      return {
        draft: {
          amountSatsFromInvoice: metadata?.amount,
          description: metadata?.description,
          invoice: destination.value,
          kind: 'bolt11'
        },
        ok: true
      }
    case 'lnaddress':
      return {
        draft: { address: destination.value, kind: 'lnaddress' },
        ok: true
      }
    case 'lnurl':
      return {
        draft: { kind: 'lnurl', lnurl: destination.value },
        ok: true
      }
    case 'bitcoin-address':
      return {
        draft: { address: destination.value, kind: 'onchain' },
        ok: true
      }
    default:
      return { ok: false, reason: 'unsupported' }
  }
}

export function destinationKindFromDraft(
  draft: ArkDestinationDraft
): ArkSendKind {
  return draft.kind
}
