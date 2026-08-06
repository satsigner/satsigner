import {
  mapPayjoinRoundtripError,
  PAYJOIN_ROUNDTRIP_STEP_KEYS,
  PAYJOIN_ROUNDTRIP_STEPS,
  payjoinRoundtripStepLabel
} from '@/utils/payjoinLiveRoundtrip'

describe('payjoinLiveRoundtrip helpers', () => {
  it('exposes the roundtrip steps in Sample→Clown order', () => {
    expect(PAYJOIN_ROUNDTRIP_STEPS).toStrictEqual([
      'preconditions',
      'createReceiver',
      'buildOriginal',
      'startSend',
      'pollReceiver',
      'finalizeReceiver',
      'pollSend',
      'broadcast'
    ])
  })

  it('has a locale key and a non-empty label for every step', () => {
    for (const step of PAYJOIN_ROUNDTRIP_STEPS) {
      expect(PAYJOIN_ROUNDTRIP_STEP_KEYS[step]).toMatch(
        /^settings\.developer\.diagnosis\.step\./
      )
      expect(payjoinRoundtripStepLabel(step).length).toBeGreaterThan(0)
    }
  })

  it('maps a thrown error to its compact message', () => {
    expect(mapPayjoinRoundtripError(new Error('boom'))).toContain('boom')
    expect(typeof mapPayjoinRoundtripError('plain string')).toBe('string')
  })
})
