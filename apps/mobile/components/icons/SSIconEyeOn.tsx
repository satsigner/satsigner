import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

const VIEW = 24

export default function SSIconEyeOn({
  width,
  height,
  stroke = '#828282'
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
    >
      <Path
        d="M4 12C6.5 8 9.2 6 12 6s5.5 2 8 6c-2.5 4-5.2 6-8 6s-5.5-2-8-6Z"
        stroke={stroke}
        strokeWidth={1}
      />
      <Circle
        cx={12}
        cy={12}
        r={3}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
      />
    </Svg>
  )
}
