import Svg, { Path, type SvgProps } from 'react-native-svg'

import { Colors } from '@/styles'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

export default function SSIconHistoryChart({
  width,
  height,
  stroke = Colors.gray[200]
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 17 10"
      fill="none"
      stroke={stroke}
    >
      <Path d="M0.605469 9.00007H4.47669V2.00007H9.07376V5.9566H10.8884V0.500031L12.9299 0.5V2.98917H16.1055" />
    </Svg>
  )
}
