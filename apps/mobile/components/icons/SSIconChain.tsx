import Svg, { Circle, G, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconChain({
  width = 21,
  height = 25,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21 25" fill="none">
      <G filter="url(#filter0_i_1_129)">
        <Circle
          cx={15.0032}
          cy={7.74594}
          r={3.44801}
          transform="rotate(25.3996 15.0032 7.74594)"
          stroke="#DCDCDC"
        />
      </G>
      <Rect
        x={4.23029}
        y={13.6324}
        width={8.95698}
        height={2.69849}
        rx={1.34924}
        transform="rotate(-2.54643 4.23029 13.6324)"
        stroke={color}
      />
      <Rect
        x={2.74022}
        y={16.7707}
        width={8.95698}
        height={2.69849}
        rx={1.34924}
        transform="rotate(-2.54643 2.74022 16.7707)"
        stroke={color}
      />
      <Rect
        x={5.75119}
        y={10.4292}
        width={8.95698}
        height={2.69849}
        rx={1.34924}
        transform="rotate(-2.54643 5.75119 10.4292)"
        stroke={color}
      />
      <Rect
        x={7.31429}
        y={7.13696}
        width={8.95698}
        height={2.69849}
        rx={1.34924}
        transform="rotate(-2.54643 7.31429 7.13696)"
        stroke={color}
      />
    </Svg>
  )
}
