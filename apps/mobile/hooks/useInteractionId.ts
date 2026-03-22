import { useCallback } from 'react'
import { useSharedValue } from 'react-native-reanimated'

export const useInteractionId = () => {
  const interactionId = useSharedValue('')

  const getInteractionId = useCallback(
    () => interactionId.value,
    [interactionId]
  )

  const updateInteractionId = useCallback(() => {
    interactionId.value = `${Date.now()}`
  }, [interactionId])

  return { getInteractionId, updateInteractionId }
}
