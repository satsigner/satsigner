import { type ReactNode, type RefObject, useRef } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'

import SSQRCode from './SSQRCode'
import SSShareButton from './SSShareButton'

type SSShareableQRProps = {
  value: string
  size?: number
  ecl?: 'H' | 'Q' | 'M' | 'L'
  color?: string
  backgroundColor?: string
  containerStyle?: StyleProp<ViewStyle>
  qrRef?: RefObject<View | null>
  hideShareButton?: boolean
  children?: ReactNode
}

function SSShareableQR({
  value,
  size,
  ecl,
  color,
  backgroundColor,
  containerStyle,
  qrRef: externalRef,
  hideShareButton = false,
  children
}: SSShareableQRProps) {
  const internalRef = useRef<View>(null)
  const qrRef = externalRef ?? internalRef

  return (
    <>
      <View collapsable={false} ref={qrRef} style={containerStyle}>
        <SSQRCode
          value={value}
          size={size}
          ecl={ecl}
          color={color}
          backgroundColor={backgroundColor}
        />
      </View>
      {children}
      {!hideShareButton && <SSShareButton qrRef={qrRef} />}
    </>
  )
}

export default SSShareableQR
