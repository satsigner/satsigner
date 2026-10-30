import { useRef } from 'react'

export const useGestureInteractionFlags = () => {
  const isInteractingRef = useRef(false)
  const isPinchingRef = useRef(false)

  const isInteracting = () => isInteractingRef.current
  const setInteracting = (interacting: boolean) => {
    isInteractingRef.current = interacting
  }
  const isPinching = () => isPinchingRef.current
  const setPinching = (pinching: boolean) => {
    isPinchingRef.current = pinching
  }

  return { isInteracting, isPinching, setInteracting, setPinching }
}
