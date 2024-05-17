import { LinearGradient } from 'expo-linear-gradient'

import { Colors } from '@/styles'

type SSBackgroundGradientProps = {
  orientation: 'horizontal' | 'diagonal'
  children: React.ReactNode
}

export default function SSBackgroundGradient({
  orientation,
  children
}: SSBackgroundGradientProps) {
  const start =
    orientation === 'diagonal' ? { x: 0.94, y: 1.0 } : { x: 0.86, y: 1.0 }
  const end =
    orientation === 'diagonal' ? { x: 0.86, y: -0.64 } : { x: 0.14, y: 1.0 }

  return (
    <LinearGradient
      colors={[Colors.gray[900], Colors.gray[800]]}
      start={start}
      end={end}
    >
      {children}
    </LinearGradient>
  )
}
