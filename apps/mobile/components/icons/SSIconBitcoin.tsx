import Svg, { Path, type SvgProps } from 'react-native-svg'

import { type NavMenuItemIconProps } from '@/types/navigation/navMenu'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'> & {
  strokeWidth?: number
}

export default function SSIconBitcoin({
  width = 22,
  height = 22,
  color = 'white',
  strokeWidth = 2
}: IconProps & NavMenuItemIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
