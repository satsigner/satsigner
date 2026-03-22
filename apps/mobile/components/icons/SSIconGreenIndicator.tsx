import { Image } from 'react-native'

interface IconProps {
  width: number
  height: number
}

export default function SSIconGreenIndicator({ width, height }: IconProps) {
  return (
    <Image
      source={require('@/assets/green-indicator.png')}
      style={{ height, width }}
    />
  )
}
