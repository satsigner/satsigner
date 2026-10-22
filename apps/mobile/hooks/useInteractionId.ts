import { useCallback } from 'react'
import { useSharedValue } from 'react-native-reanimated'

export const useInteractionId = () => {
  const interactionId = useSharedValue('')

  const getInteractionId = useCallback(
    function getInteractionIdWorklet() {
      'worklet'
      return interactionId.get()
    },
    [interactionId]
  )

  const updateInteractionId = useCallback(() => {
    interactionId.set(`${Date.now()}`)
  }, [interactionId])

  return { getInteractionId, updateInteractionId }
}
