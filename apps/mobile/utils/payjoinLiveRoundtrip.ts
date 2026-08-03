import {
  clearReceiverSessionsForAccount,
  createReceivePayjoinSession,
  finalizeReceiverPayjoin,
  pollBip77Send,
  pollReceiverSession,
  startBip77Send
} from '@/api/payjoin'
import {
  PAYJOIN_BIP77_SEND_TIMEOUT_MS,
  PAYJOIN_DEFAULT_PJOS
} from '@/constants/payjoin'
import { t } from '@/locales'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import {
  type PayjoinSession,
  type PayjoinWalletCallbacks
} from '@/types/payjoin'
import { type Network } from '@/types/settings/blockchain'
import { compactError } from '@/utils/payjoinLog'

/** Ordered steps of the live Signet BIP77 roundtrip (Sample → Clown). */
const PAYJOIN_ROUNDTRIP_STEPS = [
  'preconditions',
  'createReceiver',
  'buildOriginal',
  'startSend',
  'pollReceiver',
  'finalizeReceiver',
  'pollSend',
  'broadcast'
] as const

type PayjoinRoundtripStep = (typeof PAYJOIN_ROUNDTRIP_STEPS)[number]

const PAYJOIN_ROUNDTRIP_STEP_KEYS: Record<PayjoinRoundtripStep, string> = {
  broadcast: 'settings.developer.diagnosis.step.broadcast',
  buildOriginal: 'settings.developer.diagnosis.step.buildOriginal',
  createReceiver: 'settings.developer.diagnosis.step.createReceiver',
  finalizeReceiver: 'settings.developer.diagnosis.step.finalizeReceiver',
  pollReceiver: 'settings.developer.diagnosis.step.pollReceiver',
  pollSend: 'settings.developer.diagnosis.step.pollSend',
  preconditions: 'settings.developer.diagnosis.step.preconditions',
  startSend: 'settings.developer.diagnosis.step.startSend'
}

function payjoinRoundtripStepLabel(step: PayjoinRoundtripStep): string {
  return t(PAYJOIN_ROUNDTRIP_STEP_KEYS[step])
}

/** Map an arbitrary roundtrip failure to a compact, user-facing message. */
function mapPayjoinRoundtripError(error: unknown): string {
  if (error instanceof PayjoinRoundtripAbortError) {
    return t('settings.developer.diagnosis.error.cancelled')
  }
  return compactError(error)
}

class PayjoinRoundtripAbortError extends Error {
  constructor() {
    super('payjoin roundtrip aborted')
    this.name = 'PayjoinRoundtripAbortError'
  }
}

const POLL_INTERVAL_MS = 1000
const MAX_POLL_ATTEMPTS = Math.ceil(
  PAYJOIN_BIP77_SEND_TIMEOUT_MS / POLL_INTERVAL_MS
)

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PayjoinRoundtripAbortError())
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new PayjoinRoundtripAbortError())
      },
      { once: true }
    )
  })
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new PayjoinRoundtripAbortError()
  }
}

/**
 * Runtime handles the diagnostics screen supplies. The orchestration lives here;
 * the screen only wires the wallet/BDK/broadcast operations it already owns.
 */
type PayjoinRoundtripEnv = {
  network: Network
  senderAccountId: string
  receiverAccountId: string
  receiverAddress: string
  paymentAmountSats: number
  senderCallbacks: PayjoinWalletCallbacks
  senderOutputScriptsHex: string[]
  receiverCallbacks: PayjoinWalletCallbacks
  /** Build + sign (not finalize) the Sample original PSBT paying the Clown address. */
  buildAndSignOriginal: (
    toAddress: string,
    amountSats: number
  ) => Promise<string>
  /** Broadcast the final Payjoin PSBT via the configured Signet backend. */
  broadcast: (payjoinPsbtBase64: string) => Promise<string>
}

type PayjoinRoundtripResult =
  | { ok: true; txid: string }
  | { ok: false; error: string }

async function pollForOriginal(params: {
  session: PayjoinSession
  callbacks: PayjoinWalletCallbacks
  signal?: AbortSignal
}): Promise<PayjoinSession> {
  let current = params.session
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    throwIfAborted(params.signal)
    const polled = await pollReceiverSession({
      callbacks: params.callbacks,
      session: current
    })
    current = polled.session
    if (polled.originalPsbtBase64 || current.originalPsbtBase64) {
      return current
    }
    await delay(POLL_INTERVAL_MS, params.signal)
  }
  throw new Error(t('settings.developer.diagnosis.error.receiverTimeout'))
}

async function pollForProposal(params: {
  session: PayjoinSession
  paymentAmountSats: number
  callbacks: PayjoinWalletCallbacks
  outputScriptsHex: string[]
  signal?: AbortSignal
}): Promise<string> {
  let current = params.session
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    throwIfAborted(params.signal)
    const result = await pollBip77Send({
      callbacks: params.callbacks,
      disableOutputSubstitution: PAYJOIN_DEFAULT_PJOS === 0,
      outputScriptsHex: params.outputScriptsHex,
      paymentAmountSats: params.paymentAmountSats,
      session: current
    })
    if (result.kind === 'proposal') {
      return result.result.psbtBase64
    }
    if (result.kind === 'fallback') {
      throw new Error(result.reason)
    }
    current = result.session
    await delay(POLL_INTERVAL_MS, params.signal)
  }
  throw new Error(t('settings.developer.diagnosis.error.senderTimeout'))
}

/**
 * Run a real, in-process BIP77 Payjoin roundtrip against the directory
 * (Sample sender → Clown receiver) on Signet and broadcast the result.
 *
 * Device-only: needs the native PDK, funded Signet accounts, and network access.
 */
async function runPayjoinLiveRoundtrip(params: {
  env: PayjoinRoundtripEnv
  onStep: (message: string) => void
  signal?: AbortSignal
}): Promise<PayjoinRoundtripResult> {
  const { env, onStep, signal } = params
  try {
    onStep(payjoinRoundtripStepLabel('preconditions'))
    if (env.network === 'bitcoin') {
      return {
        error: t('settings.developer.diagnosis.error.mainnet'),
        ok: false
      }
    }
    throwIfAborted(signal)

    onStep(payjoinRoundtripStepLabel('createReceiver'))
    const receiverSession = await createReceivePayjoinSession({
      accountId: env.receiverAccountId,
      address: env.receiverAddress,
      amountSats: env.paymentAmountSats
    })
    if (receiverSession.error || !receiverSession.nativeState) {
      return {
        error:
          receiverSession.error ??
          t('settings.developer.diagnosis.error.nativeUnavailable'),
        ok: false
      }
    }
    throwIfAborted(signal)

    onStep(payjoinRoundtripStepLabel('buildOriginal'))
    const originalPsbtBase64 = await env.buildAndSignOriginal(
      receiverSession.address,
      env.paymentAmountSats
    )
    throwIfAborted(signal)

    onStep(payjoinRoundtripStepLabel('startSend'))
    const started = await startBip77Send({
      accountId: env.senderAccountId,
      callbacks: env.senderCallbacks,
      disableOutputSubstitution: PAYJOIN_DEFAULT_PJOS === 0,
      originalPsbtBase64,
      outputScriptsHex: env.senderOutputScriptsHex,
      payjoinUri: receiverSession.uri,
      paymentAmountSats: env.paymentAmountSats
    })
    if (started.kind === 'fallback') {
      clearReceiverSessionsForAccount(env.receiverAccountId)
      return { error: started.reason, ok: false }
    }

    onStep(payjoinRoundtripStepLabel('pollReceiver'))
    const receiverWithOriginal = await pollForOriginal({
      callbacks: env.receiverCallbacks,
      session: receiverSession,
      signal
    })

    onStep(payjoinRoundtripStepLabel('finalizeReceiver'))
    const finalized = await finalizeReceiverPayjoin({
      callbacks: env.receiverCallbacks,
      session: receiverWithOriginal
    })
    if (finalized.status === 'error') {
      clearReceiverSessionsForAccount(env.receiverAccountId)
      return {
        error:
          finalized.error ??
          t('settings.developer.diagnosis.error.receiverTimeout'),
        ok: false
      }
    }

    onStep(payjoinRoundtripStepLabel('pollSend'))
    const payjoinPsbtBase64 =
      started.kind === 'proposal'
        ? started.result.psbtBase64
        : await pollForProposal({
            callbacks: env.senderCallbacks,
            outputScriptsHex: env.senderOutputScriptsHex,
            paymentAmountSats: env.paymentAmountSats,
            session: started.session,
            signal
          })

    onStep(payjoinRoundtripStepLabel('broadcast'))
    throwIfAborted(signal)
    const txid = await env.broadcast(payjoinPsbtBase64)

    clearReceiverSessionsForAccount(env.receiverAccountId)
    const store = usePayjoinSessionsStore.getState()
    for (const session of store.sessions) {
      if (
        session.accountId === env.senderAccountId &&
        session.role === 'sender'
      ) {
        store.updateSessionStatus(session.id, 'completed')
      }
    }

    return { ok: true, txid }
  } catch (error) {
    clearReceiverSessionsForAccount(env.receiverAccountId)
    return { error: mapPayjoinRoundtripError(error), ok: false }
  }
}

export {
  mapPayjoinRoundtripError,
  PAYJOIN_ROUNDTRIP_STEP_KEYS,
  PAYJOIN_ROUNDTRIP_STEPS,
  payjoinRoundtripStepLabel,
  runPayjoinLiveRoundtrip
}

export type {
  PayjoinRoundtripEnv,
  PayjoinRoundtripResult,
  PayjoinRoundtripStep
}
