import Svg, { Circle, Line, type SvgProps } from 'react-native-svg'

import { type NavMenuItemIconProps } from '@/types/navigation/navMenu'

type SSIconServerProps = Pick<SvgProps, 'width' | 'height' | 'color'>

const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315]
const CX = 12
const CY = 12
const INNER_R = 6.5
const OUTER_R = 10

export default function SSIconServer({
  width = 24,
  height = 24,
  color = '#909090'
}: SSIconServerProps & NavMenuItemIconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1}
    >
      <Circle cx={CX} cy={CY} r={4.5} />
      {SPOKES.map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <Line
            key={deg}
            x1={CX + INNER_R * Math.cos(rad)}
            y1={CY + INNER_R * Math.sin(rad)}
            x2={CX + OUTER_R * Math.cos(rad)}
            y2={CY + OUTER_R * Math.sin(rad)}
          />
        )
      })}
    </Svg>
  )
}
