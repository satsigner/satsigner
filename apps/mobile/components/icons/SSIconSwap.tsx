import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconSwap({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <Path
        d="M11 1L14 4L11 7"
        stroke="#858585"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 4H14"
        stroke="#858585"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <Path
        d="M5 9L2 12L5 15"
        stroke="#858585"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 12H2"
        stroke="#858585"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </Svg>
  )
}
