import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconBackArrow({ width = 5, height = 12 }: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 5 12"
      fill="none"
      stroke="#828282"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    >
      <Path d="m3.895 10.5-3-4.5 3-4.5" />
    </Svg>
  )
}
