import { Image } from 'react-native'

import { Colors } from '@/styles'

type IconProps = {
  width: number
  height: number
}

// Same asset + dimensions as the green dot; muted red via tint
export default function SSIconMutedRedIndicator({ width, height }: IconProps) {
  return (
    <Image
      source={require('@/assets/green-indicator.png')}
      style={{
        height,
        tintColor: Colors.softBarRed,
        width
      }}
    />
  )
}
