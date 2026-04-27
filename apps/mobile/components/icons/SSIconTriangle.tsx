import Svg, { Path, type SvgProps } from 'react-native-svg'

import { type NavMenuItemIconProps } from '@/types/navigation/navMenu'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color' | 'strokeWidth'> &
  NavMenuItemIconProps

export default function SSIconTriangle({
  width = 18,
  height = 20,
  color = 'white',
  focused = false,
  strokeWidth = 1.35
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 20" fill="none">
      <Path
        d="M9 3.35 L16 17.2 Q9 15.35 2 17.2 Z"
        fill={focused ? color : 'none'}
        stroke={focused ? 'none' : color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  )
}
