import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'> & {
  color?: string
}

export default function SSIconRepost({
  width,
  height,
  color = '#777777'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 16" fill="none">
      <Path
        d="M13 1L16 4L13 7"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M2 4H16" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <Path
        d="M5 15L2 12L5 9"
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M16 12H2" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </Svg>
  )
}
