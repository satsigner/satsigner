import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

import { Colors } from '@/styles'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

export default function SSIconSearch({
  width,
  height,
  stroke = Colors.gray[200]
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 18 18"
      fill="none"
      stroke={stroke}
    >
      <Circle cx="8" cy="8" r="5.5" strokeWidth="1.2" />
      <Path d="M12.2 12.2 L16.5 16.5" strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  )
}
