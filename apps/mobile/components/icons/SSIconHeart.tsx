import Svg, { Path, type SvgProps } from 'react-native-svg'

import { Colors } from '@/styles'

type IconProps = Pick<SvgProps, 'width' | 'height'> & {
  color?: string
  filled?: boolean
}

export default function SSIconHeart({
  width,
  height,
  color = Colors.gray[300],
  filled = false
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.25s-7.6-4.55-9.35-9.55C1.55 7.6 3.4 4.3 6.7 3.9c2.05-.25 3.9.8 5.3 2.75 1.4-1.95 3.25-3 5.3-2.75 3.3.4 5.15 3.7 4.05 6.8-1.75 5-9.35 9.55-9.35 9.55Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
