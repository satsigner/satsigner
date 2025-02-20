import { Image } from 'react-native'

type IconProps = {
  width: number
  height: number
}

export default function SSIconGreenIndicator({ width, height }: IconProps) {
  return (
    <Image
      source={require('@/assets/green-indicator.png')}
      style={{ width, height }}
    />
  )
}
