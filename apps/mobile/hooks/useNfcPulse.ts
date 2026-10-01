import { useEffect } from 'react'
import {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'

import { Colors } from '@/styles'

const NFC_PULSE_SIZE = 200
const NFC_PULSE_DURATION_MS = 1000

/**
 * Style for the pulsing circle shown while an NFC read/emit is in progress.
 * The pulse runs only while `active` is true.
 */
export function useNfcPulse(active: boolean) {
  const pulse = useSharedValue(0)

  useEffect(() => {
    if (!active) {
      return
    }
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: NFC_PULSE_DURATION_MS }),
          withTiming(0, { duration: NFC_PULSE_DURATION_MS })
        ),
        -1
      )
    )
    return () => {
      cancelAnimation(pulse)
      pulse.set(0)
    }
  }, [active, pulse])

  return useAnimatedStyle(() => ({
    alignItems: 'center',
    backgroundColor: interpolateColor(
      pulse.value,
      [0, 1],
      [Colors.gray[800], Colors.gray[400]]
    ),
    borderRadius: NFC_PULSE_SIZE / 2,
    height: NFC_PULSE_SIZE,
    justifyContent: 'center',
    width: NFC_PULSE_SIZE
  }))
}
