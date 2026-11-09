import { Image } from 'react-native'

type IconProps = {
  color: string
  height: number
  width: number
}

// Same glowing dot asset as the other indicators, tinted to any color
export default function SSIconStatusDot({ color, height, width }: IconProps) {
  return (
    <Image
      source={require('@/assets/green-indicator.png')}
      style={{ height, tintColor: color, width }}
    />
  )
}
