import { requireNativeView } from 'expo'
import type { StyleProp, ViewStyle } from 'react-native'

export type CodeScannedEvent = {
  nativeEvent: { data: string }
}

export type CameraErrorEvent = {
  nativeEvent: { message: string }
}

export type SsQrScannerViewProps = {
  onCameraError?: (event: CameraErrorEvent) => void
  onCodeScanned?: (event: CodeScannedEvent) => void
  scanning: boolean
  style?: StyleProp<ViewStyle>
  zoom: number
}

/** Android-only camera view that decodes QR codes with zxing-cpp. */
export const SsQrScannerView =
  requireNativeView<SsQrScannerViewProps>('SsQrScanner')
