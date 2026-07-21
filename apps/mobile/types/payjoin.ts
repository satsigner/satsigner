type PayjoinProtocolVersion = 'v1' | 'v2'

type PayjoinEndpointKind = 'bip78' | 'bip77'

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

export type {
  PayjoinBip78Error,
  PayjoinBip78ErrorCode,
  PayjoinEndpointKind,
  PayjoinNativeRequest,
  PayjoinProtocolVersion,
  PayjoinSendResult,
  PayjoinSession,
  PayjoinSessionRole,
  PayjoinSessionStatus,
  PayjoinUriParams,
  PayjoinWalletCallbacks
}
