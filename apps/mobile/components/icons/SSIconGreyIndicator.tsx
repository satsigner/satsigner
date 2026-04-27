import { Image } from 'react-native'

import { Colors } from '@/styles'

type IconProps = {
  width: number
  height: number
}

// Same asset + dimensions as the green dot; grey via tint
export default function SSIconGreyIndicator({ width, height }: IconProps) {
  return (
    <Image
      source={require('@/assets/green-indicator.png')}
      style={{
        height,
        tintColor: Colors.gray['500'],
        width
      }}
    />
  )
}
