import Svg, { Path, type SvgProps } from 'react-native-svg'

import { Colors } from '@/styles'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

export default function SSIconScan({
  width = 24,
  height = 24,
  stroke = Colors.gray[400]
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    </Svg>
  )
}
