import Svg, { Circle, Line, Rect, type SvgProps } from 'react-native-svg'

import { getIconStrokeProps, type IconStrokeProps } from './iconStroke'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconFiat({
  width = 24,
  height = 16,
  screenStrokeWidth
}: IconProps & IconStrokeProps) {
  const strokeProps = getIconStrokeProps(screenStrokeWidth)
  return (
    <Svg width={width} height={height} viewBox="0 0 24 16" fill="none">
      <Rect
        x="0.5"
        y="0.5"
        width="23"
        height="15"
        rx="2"
        stroke="#828282"
        {...strokeProps}
      />
      <Circle cx="12" cy="8" r="3.5" stroke="#fff" {...strokeProps} />
      <Line x1="3" y1="4" x2="3" y2="12" stroke="#828282" {...strokeProps} />
      <Line x1="21" y1="4" x2="21" y2="12" stroke="#828282" {...strokeProps} />
    </Svg>
  )
}
