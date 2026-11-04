import { requireNativeView } from 'expo'
import type { StyleProp, ViewStyle } from 'react-native'

export type CodeScannedEvent = {
  nativeEvent: { data: string }
}

export type SsQrScannerViewProps = {
  onCodeScanned?: (event: CodeScannedEvent) => void
  scanning: boolean
  style?: StyleProp<ViewStyle>
  zoom: number
}

/** Android-only camera view that decodes QR codes with zxing-cpp. */
export const SsQrScannerView =
  requireNativeView<SsQrScannerViewProps>('SsQrScanner')
