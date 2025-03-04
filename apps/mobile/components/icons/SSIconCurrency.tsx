import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconCurrency({
  width = 16,
  height = 23,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 23" fill="none">
      <G>
        <Circle cx="8" cy="11" r="7.5" stroke={color} />
        <Path d="M6 16L9 19L6 22" stroke={color} strokeLinecap="round" />
        <Path d="M9 7L6 4L9 1" stroke={color} strokeLinecap="round" />
      </G>
    </Svg>
  )
}
