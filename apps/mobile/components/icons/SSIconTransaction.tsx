import Svg, { Circle, Line, Polygon, type SvgProps } from 'react-native-svg'

import { type NavMenuItemIconProps } from '@/types/navigation/navMenu'

type SSIconTransactionProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconTransaction({
  width = 24,
  height = 14,
  color = '#909090'
}: SSIconTransactionProps & NavMenuItemIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 14" fill="none">
      {/* Input dot */}
      <Circle cx="2" cy="4" r="1.5" stroke={color} strokeWidth="1" />
      {/* Input arrow line */}
      <Line x1="3.5" y1="4" x2="14" y2="4" stroke={color} strokeWidth="1" />
      {/* Arrowhead */}
      <Polygon points="14,1.5 18,4 14,6.5" fill={color} />
      {/* Output line */}
      <Line x1="18" y1="10" x2="8" y2="10" stroke={color} strokeWidth="1" />
      {/* Output arrowhead (pointing left) */}
      <Polygon points="8,7.5 4,10 8,12.5" fill={color} />
      {/* Output dot */}
      <Circle cx="22" cy="10" r="1.5" stroke={color} strokeWidth="1" />
    </Svg>
  )
}
