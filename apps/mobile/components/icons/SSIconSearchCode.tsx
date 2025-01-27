import Svg, { Path, Circle, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconSearchCode({ width, height }: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Path d="m13 13.5 2-2.5-2-2.5"/>
      <Path d="m21 21-4.3-4.3"/>
      <Path d="M9 8.5 7 11l2 2.5"/>
      <Circle cx="11" cy="11" r="8"/>
    </Svg>
  )
}
