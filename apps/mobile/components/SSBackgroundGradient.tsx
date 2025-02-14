import { LinearGradient } from 'expo-linear-gradient'
import { type StyleProp, type ViewStyle } from 'react-native'

import { Colors } from '@/styles'

type SSBackgroundGradientProps = {
  orientation?: 'horizontal' | 'diagonal'
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

function SSBackgroundGradient({
  orientation = 'diagonal',
  style,
  children
}: SSBackgroundGradientProps) {
  const start =
    orientation === 'diagonal' ? { x: 0.94, y: 1.0 } : { x: 0.86, y: 1.0 }
  const end =
    orientation === 'diagonal' ? { x: 0.86, y: -0.64 } : { x: 0.14, y: 1.0 }

  return (
    <LinearGradient
      style={style}
      colors={[Colors.gray[900], Colors.gray[800]]}
      start={start}
      end={end}
    >
      {children}
    </LinearGradient>
  )
}

export default SSBackgroundGradient
