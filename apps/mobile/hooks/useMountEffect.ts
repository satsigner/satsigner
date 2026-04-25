import { type EffectCallback, useEffect } from 'react'

export function useMountEffect(effect: EffectCallback) {
  useEffect(effect, []) // eslint-disable-line react-hooks/exhaustive-deps
}
