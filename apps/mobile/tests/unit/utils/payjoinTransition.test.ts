import {
  unwrapInitializedTransition,
  unwrapPollingProposalPsbt,
  unwrapPollingStasis
} from '@/utils/payjoinTransition'

describe('unwrapInitializedTransition', () => {
  it('reads Progress from a frozen UniFFI { inner } wrapper', () => {
    const payload = { id: 'unchecked' }
    const outcome = {
      inner: Object.freeze({ inner: payload }),
      tag: 'Progress'
    }

    expect(unwrapInitializedTransition(outcome)).toStrictEqual({
      kind: 'progress',
      value: payload
    })
  })

  it('reads Stasis from a frozen UniFFI { inner } wrapper', () => {
    const initialized = { id: 'initialized' }
    const outcome = {
      inner: Object.freeze({ inner: initialized }),
      tag: 'Stasis'
    }

    expect(unwrapInitializedTransition(outcome)).toStrictEqual({
      kind: 'stasis',
      value: initialized
    })
  })

  it('does not array-destructure inner — that throws on Hermes', () => {
    const inner = Object.freeze({ inner: { id: 'unchecked' } })
    expect(() => {
      const [value] = inner as unknown as [unknown]
      return value
    }).toThrow(/iterat/i)
  })
})

describe('unwrapPollingProposalPsbt', () => {
  it('reads Progress.psbtBase64 from the UniFFI wrapper', () => {
    const outcome = {
      inner: Object.freeze({ psbtBase64: 'cHNidP8=' }),
      tag: 'Progress'
    }
    expect(unwrapPollingProposalPsbt(outcome)).toBe('cHNidP8=')
  })

  it('returns undefined on Stasis', () => {
    const outcome = {
      inner: Object.freeze({ inner: { id: 'poller' } }),
      tag: 'Stasis'
    }
    expect(unwrapPollingProposalPsbt(outcome)).toBeUndefined()
  })
})

describe('unwrapPollingStasis', () => {
  it('returns the next poller on Stasis', () => {
    const poller = { id: 'poller' }
    const outcome = {
      inner: Object.freeze({ inner: poller }),
      tag: 'Stasis'
    }
    expect(unwrapPollingStasis(outcome)).toBe(poller)
  })

  it('returns undefined on Progress', () => {
    const outcome = {
      inner: Object.freeze({ psbtBase64: 'cHNidP8=' }),
      tag: 'Progress'
    }
    expect(unwrapPollingStasis(outcome)).toBeUndefined()
  })
})
