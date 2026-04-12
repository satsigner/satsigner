import { useCallback } from 'react'
import { useSharedValue } from 'react-native-reanimated'

export const useInteractionId = () => {
  const interactionId = useSharedValue('')

  const getInteractionId = useCallback(
    () => interactionId.get(),
    [interactionId]
  )

  const updateInteractionId = useCallback(() => {
    interactionId.set(`${new Date().valueOf()}`)
  }, [interactionId])

  return { getInteractionId, updateInteractionId }
}
