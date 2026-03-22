import Svg, { Circle, G, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

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
          cy={7.745_94}
          r={3.448_01}
          transform="rotate(25.3996 15.0032 7.74594)"
          stroke="#DCDCDC"
        />
      </G>
      <Rect
        x={4.230_29}
        y={13.6324}
        width={8.956_98}
        height={2.698_49}
        rx={1.349_24}
        transform="rotate(-2.54643 4.23029 13.6324)"
        stroke={color}
      />
      <Rect
        x={2.740_22}
        y={16.7707}
        width={8.956_98}
        height={2.698_49}
        rx={1.349_24}
        transform="rotate(-2.54643 2.74022 16.7707)"
        stroke={color}
      />
      <Rect
        x={5.751_19}
        y={10.4292}
        width={8.956_98}
        height={2.698_49}
        rx={1.349_24}
        transform="rotate(-2.54643 5.75119 10.4292)"
        stroke={color}
      />
      <Rect
        x={7.314_29}
        y={7.136_96}
        width={8.956_98}
        height={2.698_49}
        rx={1.349_24}
        transform="rotate(-2.54643 7.31429 7.13696)"
        stroke={color}
      />
    </Svg>
  )
}
