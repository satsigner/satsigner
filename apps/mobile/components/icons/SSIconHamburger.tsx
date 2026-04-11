import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

const VIEW = 24

export default function SSIconHamburger({ width, height }: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
    >
      <Path d="M5 6H19" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1} />
      <Path d="M5 12H19" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1} />
      <Path d="M5 18H19" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1} />
    </Svg>
  )
}
