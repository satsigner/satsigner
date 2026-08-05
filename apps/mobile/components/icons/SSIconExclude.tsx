import Svg, { Circle, Line, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

export default function SSIconExclude({
  width,
  height,
  stroke = '#adadad'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <Circle cx="8" cy="8" r="6.5" stroke={stroke} strokeWidth="0.75" />
      <Line
        x1="4"
        y1="12"
        x2="12"
        y2="4"
        stroke={stroke}
        strokeWidth="0.75"
        strokeLinecap="round"
      />
    </Svg>
  )
}
