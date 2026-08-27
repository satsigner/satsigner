import { type ArkServerId } from '@/types/models/Ark'

type PayjoinProtocolVersion = 'v1' | 'v2'

type PayjoinEndpointKind = 'bip78' | 'bip77'

/**
 * How Payjoin coordination happens.
 * - `directory`: BIP77/BIP78 over a Payjoin directory + OHTTP relays (interop default).
 * - `manual`: fully offline out-of-band PSBT handoff; never touches the network.
 */
type PayjoinCoordinationMode = 'directory' | 'manual'

type PayjoinUriParams = {
  address: string
  amountBtc?: number
  label?: string
  message?: string
  /** Raw pj endpoint URL (not percent-encoded). */
  pj: string
  /** Output substitution allowed: 1 = yes, 0 = no. Default per BIP78 is allowed. */
  pjos?: 0 | 1
}

type PayjoinSessionRole = 'sender' | 'receiver'

/**
 * Marks a receiver session whose destination is an Ark board funding address.
 * The receiver contributes no inputs; the finalized proposal PSBT is cosigned
 * with the ark server (boardPsbt) before it is posted back to the directory.
 * keypairIndex and expiryHeight come from boardFundingAddress and must reach
 * boardPsbt unchanged — the funding script commits to both.
 */
type PayjoinBoardDestination = {
  serverId: ArkServerId
  keypairIndex: number
  expiryHeight: number
}

type PayjoinSessionStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'waiting'
  | 'negotiating'
  | 'proposal_received'
  | 'finalizing'
  | 'completed'
  | 'fallback'
  | 'expired'
  | 'cancelled'
  | 'error'

type PayjoinSession = {
  id: string
  accountId: string
  role: PayjoinSessionRole
  protocol: PayjoinProtocolVersion
  status: PayjoinSessionStatus
  address: string
  /** Full BIP21 URI including pj= (receiver) or scanned URI (sender). */
  uri: string
  pjEndpoint: string
  pjos: 0 | 1
  amountSats?: number
  label?: string
  /** Present on receiver sessions that fund an Ark board via payjoin. */
  board?: PayjoinBoardDestination
  /** Opaque PDK/native session blob for resume. */
  nativeState?: string
  originalPsbtBase64?: string
  proposalPsbtBase64?: string
  payjoinPsbtBase64?: string
  txid?: string
  error?: string
  createdAt: number
  updatedAt: number
  expiresAt: number
}

type PayjoinBip78ErrorCode =
  | 'unavailable'
  | 'not-enough-money'
  | 'version-unsupported'
  | 'original-psbt-rejected'
  | 'unknown'

type PayjoinBip78Error = {
  errorCode: PayjoinBip78ErrorCode
  message: string
}

type PayjoinSendResult =
  | {
      ok: true
      usedPayjoin: true
      psbtBase64: string
      protocol: PayjoinProtocolVersion
    }
  | {
      ok: true
      usedPayjoin: false
      reason: string
      originalPsbtBase64: string
    }
  | {
      ok: false
      error: string
      fallbackAllowed: boolean
      originalPsbtBase64?: string
    }

type PayjoinWalletCallbacks = {
  isScriptOwned: (scriptHex: string) => boolean | Promise<boolean>
  hasSeenInput: (outpoint: string) => boolean | Promise<boolean>
  markInputSeen: (outpoint: string) => void | Promise<void>
  listCandidateOutpoints: () =>
    | { txid: string; vout: number; value: number; scriptHex: string }[]
    | Promise<
        { txid: string; vout: number; value: number; scriptHex: string }[]
      >
  signPsbt: (psbtBase64: string) => string | Promise<string>
  testMempoolAccept?: (txHex: string) => boolean | Promise<boolean>
}

type PayjoinNativeRequest = {
  url: string
  body: Uint8Array
  contentType: string
}

type HttpResponse = {
  status: number
  body: Uint8Array
}

type ReceiverSessionInit = {
  address: string
  directoryUrl: string
  ohttpRelayUrl: string
  expireSeconds: number
}

type ReceiverSessionHandle = {
  id: string
  pjUri: string
  state: string
}

type SenderSessionInit = {
  pjUri: string
  originalPsbtBase64: string
  disableOutputSubstitution: boolean
}

type SenderSessionHandle = {
  id: string
  protocol: PayjoinProtocolVersion
  state: string
  request?: PayjoinNativeRequest
}

/**
 * Outcome of advancing a native session one step. `state` carries the updated
 * resumable blob, so callers persist it after every transition.
 */
type ProcessResult =
  | { kind: 'pending'; nextRequest?: PayjoinNativeRequest; state: string }
  | { kind: 'proposal'; psbtBase64: string; state: string }
  | { kind: 'completed'; state: string }
  | { kind: 'error'; message: string }

export type {
  HttpResponse,
  PayjoinBip78Error,
  PayjoinBip78ErrorCode,
  PayjoinBoardDestination,
  PayjoinCoordinationMode,
  PayjoinEndpointKind,
  PayjoinNativeRequest,
  PayjoinProtocolVersion,
  PayjoinSendResult,
  PayjoinSession,
  PayjoinSessionRole,
  PayjoinSessionStatus,
  PayjoinUriParams,
  PayjoinWalletCallbacks,
  ProcessResult,
  ReceiverSessionHandle,
  ReceiverSessionInit,
  SenderSessionHandle,
  SenderSessionInit
}
