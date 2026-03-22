import { Image } from 'react-native'

interface IconProps {
  width: number
  height: number
}

export default function SSIconBlackIndicator({ width, height }: IconProps) {
  return (
    <Image
      source={require('@/assets/black-indicator.png')}
      style={{ height, width }}
    />
  )
}
