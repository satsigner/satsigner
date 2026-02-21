import { type Account } from '@/types/models/Account'

// Wrapped events / other devices may have clock skew; reject only if created_at
// is far in the future (match 48h subscription padding).
export const DM_FUTURE_TOLERANCE_SEC = 48 * 60 * 60

export type UnwrappedNostrEvent = {
  id: string
  pubkey: string
  content: string
  created_at?: number
  tags?: unknown[][]
}

export type NostrMessageData = {
  data_type: 'LabelsBip329' | 'Tx' | 'PSBT' | 'SignMessageRequest'
  data?: unknown
}

export type MessageHandlerContext = {
  account: Account
  unwrappedEvent: UnwrappedNostrEvent
  eventContent: Record<string, unknown>
  data?: NostrMessageData
  lastDataExchangeEOSE: number
  syncStartSec: number
}

export type MessageHandler = {
  canHandle: (context: MessageHandlerContext) => boolean
  handle: (context: MessageHandlerContext) => Promise<void>
}

export type PendingDM = {
  unwrappedEvent: UnwrappedNostrEvent
  eventContent: Record<string, unknown>
}

export type NostrMessage = {
  id: string
  author: string
  created_at: number
  description: string
  event: string
  label: number
  content: {
    description: string
    created_at: number
    pubkey?: string
  }
}
