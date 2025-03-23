import Svg, { Circle, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconSignerActive({
  width = 22,
  height = 22,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 22 22" fill="none">
      <Circle cx="11" cy="11" r="11" fill={color} />
    </Svg>
  )
}
