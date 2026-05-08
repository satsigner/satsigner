import { decode } from 'bitcoin-decoder'

import type { ArkSendKind } from '@/types/models/Ark'

export type ArkDestinationDraft =
  | {
      kind: 'arkoor'
      address: string
    }
  | {
      kind: 'bolt11'
      invoice: string
      amountSatsFromInvoice?: number
      description?: string
    }
  | {
      kind: 'lnaddress'
      address: string
    }
  | {
      kind: 'lnurl'
      lnurl: string
    }
  | {
      kind: 'onchain'
      address: string
    }

export type ArkDestinationParseResult =
  | { ok: true; draft: ArkDestinationDraft }
  | { ok: false; reason: 'unsupported' | 'invalid' }

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

  const { destination, metadata } = decoded

  switch (destination.type) {
    case 'ark-address':
      return {
        draft: { address: destination.destination, kind: 'arkoor' },
        ok: true
      }
    case 'bolt11':
      return {
        draft: {
          amountSatsFromInvoice: metadata?.amount,
          description: metadata?.description,
          invoice: destination.destination,
          kind: 'bolt11'
        },
        ok: true
      }
    case 'lnaddress':
      return {
        draft: { address: destination.destination, kind: 'lnaddress' },
        ok: true
      }
    case 'lnurl':
      return {
        draft: { kind: 'lnurl', lnurl: destination.destination },
        ok: true
      }
    case 'bitcoin-address':
      return {
        draft: { address: destination.destination, kind: 'onchain' },
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
