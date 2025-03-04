import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconCloseThin({
  width = 15,
  height = 15,
  color = '#A6A6A6'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 15 15" fill="none">
      <Path d="M1 14L14 1" stroke={color} />
      <Path d="M14 14L1.43421 1" stroke={color} />
    </Svg>
  )
}
