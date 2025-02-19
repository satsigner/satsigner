import QRCode from 'react-native-qrcode-svg'

import { Colors } from '@/styles'

type SSQRCodeProps = {
  value: string
  size?: number
  ecl?: 'H' | 'Q' | 'M' | 'L'
}

function SSQRCode({ value, size = 200, ecl = 'H' }: SSQRCodeProps) {
  return (
    <QRCode
      value={value}
      size={size}
      color={Colors.white}
      backgroundColor={Colors.gray[950]}
      ecl={ecl}
    />
  )
}

export default SSQRCode
