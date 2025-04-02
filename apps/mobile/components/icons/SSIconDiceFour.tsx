import Svg, { Circle, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconDiceFour({
  width = 89,
  height = 90,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 89 90" fill="none">
      <Rect
        x={0.973}
        y={1.371}
        width={87.457}
        height={87.457}
        stroke={color}
        rx={9.5}
      />
      <Circle cx={24.135} cy={66.489} r={10.696} fill={color} />
      <Circle cx={64.225} cy={23.708} r={10.696} fill={color} />
      <Circle cx={24.135} cy={23.708} r={10.696} fill={color} />
      <Circle cx={64.225} cy={66.489} r={10.696} fill={color} />
    </Svg>
  )
}
