import * as React from 'react'
import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconSync({
  width = 10,
  height = 9,
  color = '#fff'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 10 9" fill="none">
      {/* Filled path */}
      <Path d="M1.714 6.104v1.84-1.84Z" fill={color} />
      {/* Stroked path */}
      <Path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={0.8}
        d="M8.667 4.47a3.682 3.682 0 0 1-3.68 3.68c-2.033 0-3.273-2.046-3.273-2.046m0 0h1.664m-1.664 0v1.84M1.305 4.47A3.673 3.673 0 0 1 4.986.79c2.455 0 3.681 2.046 3.681 2.046m0 0V.996m0 1.84H7.033"
      />
    </Svg>
  )
}
