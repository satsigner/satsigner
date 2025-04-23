import Svg, { Circle, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconDiceSix({
  width = 90,
  height = 90,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 90 90" fill="none">
      <Rect
        x={1.206}
        y={1.371}
        width={87.457}
        height={87.457}
        stroke={color}
        rx={9.5}
      />
      <Circle cx={24.368} cy={69.733} r={10.696} fill={color} />
      <Circle cx={64.457} cy={20.464} r={10.696} fill={color} />
      <Circle cx={24.368} cy={45.099} r={10.696} fill={color} />
      <Circle cx={64.457} cy={45.099} r={10.696} fill={color} />
      <Circle cx={24.368} cy={20.464} r={10.696} fill={color} />
      <Circle cx={64.457} cy={69.733} r={10.696} fill={color} />
    </Svg>
  )
}
