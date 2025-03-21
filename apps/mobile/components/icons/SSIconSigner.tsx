import Svg, { Circle, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconSigner({
  width = 22,
  height = 22,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 22 22" fill="none">
      <Circle cx="11" cy="11" r="10.5" stroke={color} />
    </Svg>
  )
}
