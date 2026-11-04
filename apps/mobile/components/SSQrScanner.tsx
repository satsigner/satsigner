import {
  type AvailableLenses,
  type BarcodeScanningResult,
  CameraView
} from 'expo-camera'
import { Platform, type StyleProp, type ViewStyle } from 'react-native'

import { type CodeScannedEvent, SsQrScannerView } from '@/modules/ss-qr-scanner'
import { scannedPayload } from '@/utils/qrScan'

const QR_ONLY = { barcodeTypes: ['qr' as const] }

type SSQrScannerProps = {
  /** Called with each decoded payload. Leave undefined to pause scanning. */
  onScan?: (payload: string) => void
  onAvailableLensesChanged?: (event: AvailableLenses) => void
  selectedLens?: string
  style?: StyleProp<ViewStyle>
  zoom?: number
}

/**
 * Camera view that decodes QR codes. Android uses the zxing-cpp scanner in
 * modules/ss-qr-scanner, so the APK carries no Google ML Kit; iOS keeps
 * expo-camera, which decodes with AVFoundation.
 */
export default function SSQrScanner({
  onScan,
  onAvailableLensesChanged,
  selectedLens,
  style,
  zoom = 0
}: SSQrScannerProps) {
  function handleCode(
    code: BarcodeScanningResult | CodeScannedEvent['nativeEvent']
  ) {
    const payload = scannedPayload(code)
    if (payload) {
      onScan?.(payload)
    }
  }

  if (Platform.OS === 'android') {
    return (
      <SsQrScannerView
        onCodeScanned={(event) => handleCode(event.nativeEvent)}
        scanning={onScan !== undefined}
        style={style}
        zoom={zoom}
      />
    )
  }

  return (
    <CameraView
      barcodeScannerSettings={QR_ONLY}
      onAvailableLensesChanged={onAvailableLensesChanged}
      onBarcodeScanned={onScan ? handleCode : undefined}
      selectedLens={selectedLens}
      style={style}
      zoom={zoom}
    />
  )
}
