/**
 * App-facing facade over UniFFI-generated PDK bindings.
 * Keeps async signatures and `{ kind }` process results used by `@/api/payjoin`.
 */
import {
  ProcessResult as NativeProcessResult,
  ProcessResult_Tags,
  createReceiverSession as nativeCreateReceiverSession,
  createSenderSession as nativeCreateSenderSession,
  fetchOhttpKeys as nativeFetchOhttpKeys,
  httpPost as nativeHttpPost,
  isNativeAvailable as nativeIsNativeAvailable,
  receiverContributeAndFinalize as nativeReceiverContributeAndFinalize,
  receiverExtractRequest as nativeReceiverExtractRequest,
  receiverProcessResponse as nativeReceiverProcessResponse,
  resumeReceiverSession as nativeResumeReceiverSession,
  resumeSenderSession as nativeResumeSenderSession,
  senderExtractRequest as nativeSenderExtractRequest,
  senderProcessResponse as nativeSenderProcessResponse,
  type HttpResponse as NativeHttpResponse,
  type PayjoinNativeRequest as NativePayjoinNativeRequest,
  type ReceiverSessionHandle as NativeReceiverSessionHandle,
  type SenderSessionHandle as NativeSenderSessionHandle
} from './generated/satsigner_payjoin'

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
  protocol: 'v1' | 'v2'
  state: string
  request?: PayjoinNativeRequest
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

type ProcessResult =
  | { kind: 'pending'; nextRequest?: PayjoinNativeRequest; state: string }
  | { kind: 'proposal'; psbtBase64: string; state: string }
  | { kind: 'completed'; state: string }
  | { kind: 'error'; message: string }

function toUint8Array(body: ArrayBuffer | Uint8Array): Uint8Array {
  if (body instanceof Uint8Array) {
    return body
  }
  return new Uint8Array(body)
}

/** UniFFI surfaces `PayjoinError.Message` while the real text lives in `inner[0]`. */
function wrapNativeError(error: unknown): Error {
  if (
    error &&
    typeof error === 'object' &&
    'inner' in error &&
    Array.isArray((error as { inner: unknown }).inner) &&
    typeof (error as { inner: unknown[] }).inner[0] === 'string'
  ) {
    return new Error((error as { inner: string[] }).inner[0])
  }
  if (error instanceof Error) {
    return error
  }
  return new Error(String(error))
}

function callNativeSync<T>(fn: () => T): T {
  try {
    return fn()
  } catch (error) {
    throw wrapNativeError(error)
  }
}

function adaptRequest(
  request: NativePayjoinNativeRequest
): PayjoinNativeRequest {
  return {
    body: toUint8Array(request.body),
    contentType: request.contentType,
    url: request.url
  }
}

function adaptProcessResult(result: NativeProcessResult): ProcessResult {
  switch (result.tag) {
    case ProcessResult_Tags.Pending:
      return {
        kind: 'pending',
        nextRequest: result.inner.nextRequest
          ? adaptRequest(result.inner.nextRequest)
          : undefined,
        state: result.inner.state
      }
    case ProcessResult_Tags.Proposal:
      return {
        kind: 'proposal',
        psbtBase64: result.inner.psbtBase64,
        state: result.inner.state
      }
    case ProcessResult_Tags.Completed:
      return {
        kind: 'completed',
        state: result.inner.state
      }
    case ProcessResult_Tags.Error:
      return {
        kind: 'error',
        message: result.inner.message
      }
    default: {
      const _exhaustive: never = result
      return {
        kind: 'error',
        message: `unknown process result: ${JSON.stringify(_exhaustive)}`
      }
    }
  }
}

function adaptReceiverHandle(
  handle: NativeReceiverSessionHandle
): ReceiverSessionHandle {
  return {
    id: handle.id,
    pjUri: handle.pjUri,
    state: handle.state
  }
}

function adaptSenderHandle(
  handle: NativeSenderSessionHandle
): SenderSessionHandle {
  const protocol = handle.protocol === 'v1' ? 'v1' : 'v2'
  return {
    id: handle.id,
    protocol,
    request: handle.request ? adaptRequest(handle.request) : undefined,
    state: handle.state
  }
}

function isNativeAvailable(): boolean {
  try {
    // Throws when the Turbo Module / Rust crate failed to install, or when
    // JS bindings are ahead of the installed native binary (checksum miss).
    if (typeof nativeIsNativeAvailable !== 'function') {
      return false
    }
    return nativeIsNativeAvailable()
  } catch {
    return false
  }
}

async function fetchOhttpKeys(
  relayUrl: string,
  directoryUrl: string
): Promise<string> {
  return callNativeSync(() => nativeFetchOhttpKeys(relayUrl, directoryUrl))
}

async function httpPost(
  url: string,
  contentType: string,
  body: Uint8Array,
  timeoutMs = 45_000
): Promise<HttpResponse> {
  const result: NativeHttpResponse = callNativeSync(() =>
    nativeHttpPost(url, contentType, toArrayBuffer(body), BigInt(timeoutMs))
  )
  return {
    body: toUint8Array(result.body),
    status: result.status
  }
}

async function createReceiverSession(
  init: ReceiverSessionInit
): Promise<ReceiverSessionHandle> {
  return adaptReceiverHandle(
    callNativeSync(() =>
      nativeCreateReceiverSession({
        address: init.address,
        directoryUrl: init.directoryUrl,
        expireSeconds: BigInt(init.expireSeconds),
        ohttpRelayUrl: init.ohttpRelayUrl
      })
    )
  )
}

async function resumeReceiverSession(
  state: string
): Promise<ReceiverSessionHandle> {
  return adaptReceiverHandle(
    callNativeSync(() => nativeResumeReceiverSession(state))
  )
}

async function receiverExtractRequest(
  state: string
): Promise<{ request: PayjoinNativeRequest; state: string }> {
  const result = callNativeSync(() => nativeReceiverExtractRequest(state))
  return {
    request: adaptRequest(result.request),
    state: result.state
  }
}

function toArrayBuffer(body: Uint8Array): ArrayBuffer {
  return body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength
  ) as ArrayBuffer
}

async function receiverProcessResponse(
  state: string,
  body: Uint8Array
): Promise<ProcessResult> {
  return adaptProcessResult(
    callNativeSync(() =>
      nativeReceiverProcessResponse(state, toArrayBuffer(body))
    )
  )
}

async function receiverContributeAndFinalize(
  state: string,
  input: {
    txid: string
    vout: number
    value: number
    scriptHex: string
  },
  signedPsbtBase64: string
): Promise<{
  request: PayjoinNativeRequest
  state: string
  psbtBase64: string
}> {
  const result = callNativeSync(() =>
    nativeReceiverContributeAndFinalize(
      state,
      {
        scriptHex: input.scriptHex,
        txid: input.txid,
        value: BigInt(input.value),
        vout: input.vout
      },
      signedPsbtBase64
    )
  )
  return {
    psbtBase64: result.psbtBase64,
    request: adaptRequest(result.request),
    state: result.state
  }
}

async function createSenderSession(
  init: SenderSessionInit
): Promise<SenderSessionHandle> {
  return adaptSenderHandle(
    callNativeSync(() =>
      nativeCreateSenderSession({
        disableOutputSubstitution: init.disableOutputSubstitution,
        originalPsbtBase64: init.originalPsbtBase64,
        pjUri: init.pjUri
      })
    )
  )
}

async function resumeSenderSession(
  state: string
): Promise<SenderSessionHandle> {
  return adaptSenderHandle(
    callNativeSync(() => nativeResumeSenderSession(state))
  )
}

async function senderExtractRequest(
  state: string
): Promise<{ request: PayjoinNativeRequest; state: string }> {
  const result = callNativeSync(() => nativeSenderExtractRequest(state))
  return {
    request: adaptRequest(result.request),
    state: result.state
  }
}

async function senderProcessResponse(
  state: string,
  body: Uint8Array
): Promise<ProcessResult> {
  return adaptProcessResult(
    callNativeSync(() =>
      nativeSenderProcessResponse(state, toArrayBuffer(body))
    )
  )
}

export {
  createReceiverSession,
  createSenderSession,
  fetchOhttpKeys,
  httpPost,
  isNativeAvailable,
  receiverContributeAndFinalize,
  receiverExtractRequest,
  receiverProcessResponse,
  resumeReceiverSession,
  resumeSenderSession,
  senderExtractRequest,
  senderProcessResponse
}

export type {
  HttpResponse,
  ProcessResult,
  ReceiverSessionHandle,
  ReceiverSessionInit,
  SenderSessionHandle,
  SenderSessionInit
}
