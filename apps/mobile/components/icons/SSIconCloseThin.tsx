import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

const VIEW = 24

export default function SSIconCloseThin({
  width = 15,
  height = 15,
  color = '#A6A6A6'
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
    >
      <Path d="M5 19L19 5" stroke={color} strokeWidth={1} />
      <Path d="M19 19L5 5" stroke={color} strokeWidth={1} />
    </Svg>
  )
}
