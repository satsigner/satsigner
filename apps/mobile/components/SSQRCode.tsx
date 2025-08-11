import QRCode from 'react-native-qrcode-svg'

import { Colors } from '@/styles'

type SSQRCodeProps = {
  value: string
  size?: number
  ecl?: 'H' | 'Q' | 'M' | 'L'
  color?: string
  backgroundColor?: string
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
    />
  )
}

export default SSQRCode
