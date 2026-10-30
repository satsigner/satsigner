import QRCode from 'react-native-qrcode-svg'

import { Colors } from '@/styles'

type SSQRCodeProps = {
  value: string
  size?: number
  ecl?: 'H' | 'Q' | 'M' | 'L'
  color?: string
  backgroundColor?: string
}

function handleQrError() {
  // Oversized payloads throw inside react-native-qrcode-svg's render.
  // Swallowing that keeps the screen up instead of crashing the app.
}

function SSQRCode({
  value,
  size = 200,
  ecl = 'H',
  color = Colors.white,
  backgroundColor = Colors.gray[950]
}: SSQRCodeProps) {
  return (
    <QRCode
      value={value}
      size={size}
      color={color}
      backgroundColor={backgroundColor}
      ecl={ecl}
      onError={handleQrError}
    />
  )
}

export default SSQRCode
