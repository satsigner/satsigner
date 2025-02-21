import { Image } from 'react-native'

type IconProps = {
  width: number
  height: number
}

export default function SSIconBlackIndicator({ width, height }: IconProps) {
  return (
    <Image
      source={require('@/assets/black-indicator.png')}
      style={{ width, height }}
    />
  )
}
