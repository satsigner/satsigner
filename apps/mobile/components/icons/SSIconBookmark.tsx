import Svg, { Path, type SvgProps } from 'react-native-svg'

import { Colors } from '@/styles'

type IconProps = Pick<SvgProps, 'width' | 'height'> & {
  color?: string
  filled?: boolean
}

export default function SSIconBookmark({
  width,
  height,
  color = Colors.white,
  filled
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 3.5h11a1 1 0 0 1 1 1v16L12 16l-6.5 4.5v-16a1 1 0 0 1 1-1Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
