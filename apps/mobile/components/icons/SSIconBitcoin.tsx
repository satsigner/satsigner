import Svg, { Circle, type SvgProps } from 'react-native-svg'

import { type NavMenuItemIconProps } from '@/types/navigation/navMenu'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconBitcoin({
  width = 22,
  height = 22
}: IconProps & NavMenuItemIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={11} r={10.5} stroke="#DCDCDC" strokeWidth={1.5} />
    </Svg>
  )
}
