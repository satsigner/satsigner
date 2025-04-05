import Svg, { Circle, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconDiceThree({
  width = 90,
  height = 89,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 90 89" fill="none">
      <Rect
        x={1.206}
        y={0.707}
        width={87.457}
        height={87.457}
        stroke={color}
        rx={9.5}
      />
      <Circle cx={24.368} cy={65.825} r={10.696} fill={color} />
      <Circle cx={64.458} cy={23.044} r={10.696} fill={color} />
      <Circle cx={44.935} cy={44.434} r={10.696} fill={color} />
    </Svg>
  )
}
