import { useEffect } from 'react'
import type { EffectCallback } from 'react'

export function useMountEffect(effect: EffectCallback) {
  useEffect(effect, []) // eslint-disable-line react-hooks/exhaustive-deps
}
