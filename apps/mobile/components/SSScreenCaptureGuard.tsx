import { usePreventScreenCapture } from 'expo-screen-capture'
import { useId } from 'react'

// Each guard holds its own key so closing one secret view does not re-allow
// capture while another one is still mounted.
export default function SSScreenCaptureGuard() {
  usePreventScreenCapture(useId())
  return null
}
