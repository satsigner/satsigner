import { Image } from 'react-native'

type IconProps = {
  width: number
  height: number
}

export default function SSIconYellowIndicator({ width, height }: IconProps) {
  return (
    <Image
      source={require('@/assets/yellow-indicator.png')}
      style={{ width, height }}
    />
  )
}
