import Svg, { Circle, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconDiceOne({
  width = 89,
  height = 89,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 89 89" fill="none">
      <Rect
        x={0.973}
        y={0.707}
        width={87.457}
        height={87.457}
        stroke={color}
        rx={9.5}
      />
      <Circle cx={44.702} cy={44.434} r={10.696} fill={color} />
    </Svg>
  )
}
