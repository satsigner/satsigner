/**
 * UniFFI Progress/Stasis enums wrap the payload as `{ tag, inner: { inner } }`
 * (or `{ psbtBase64 }` on the sender). Array-destructuring `inner` throws
 * "iterator method is not callable" on Hermes.
 */

type InitializedTransitionResult =
  | { kind: 'progress'; value: unknown }
  | { kind: 'stasis'; value: unknown }
  | { kind: 'unknown' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readTag(value: Record<string, unknown>): string {
  return typeof value.tag === 'string' ? value.tag : String(value.tag ?? '')
}

function unwrapUniFfiInner(inner: unknown): unknown {
  if (Array.isArray(inner)) {
    return inner[0]
  }
  if (isRecord(inner) && 'inner' in inner) {
    return inner.inner
  }
  return inner
}

function unwrapInitializedTransition(
  outcome: unknown
): InitializedTransitionResult {
  if (!isRecord(outcome) || !('tag' in outcome) || !('inner' in outcome)) {
    if (isRecord(outcome)) {
      return { kind: 'progress', value: outcome }
    }
    return { kind: 'unknown' }
  }
  const value = unwrapUniFfiInner(outcome.inner)
  if (readTag(outcome).toLowerCase().includes('stasis')) {
    return { kind: 'stasis', value }
  }
  return { kind: 'progress', value }
}

function unwrapPollingProposalPsbt(outcome: unknown): string | undefined {
  if (typeof outcome === 'string') {
    return outcome
  }
  if (!isRecord(outcome) || !('tag' in outcome) || !('inner' in outcome)) {
    return undefined
  }
  if (readTag(outcome).toLowerCase().includes('stasis')) {
    return undefined
  }
  const { inner } = outcome
  if (typeof inner === 'string') {
    return inner
  }
  if (isRecord(inner) && typeof inner.psbtBase64 === 'string') {
    return inner.psbtBase64
  }
  const nested = unwrapUniFfiInner(inner)
  return typeof nested === 'string' ? nested : undefined
}

function unwrapPollingStasis(outcome: unknown): unknown | undefined {
  if (!isRecord(outcome) || !('tag' in outcome) || !('inner' in outcome)) {
    return undefined
  }
  if (!readTag(outcome).toLowerCase().includes('stasis')) {
    return undefined
  }
  return unwrapUniFfiInner(outcome.inner)
}

export {
  unwrapInitializedTransition,
  unwrapPollingProposalPsbt,
  unwrapPollingStasis
}
export type { InitializedTransitionResult }
