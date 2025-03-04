import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconTime({
  width = 16,
  height = 16,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      <G filter="url(#filter0_i_8288_24237)">
        <Circle
          cx={8.28557}
          cy={8.28547}
          r={7.21429}
          transform="rotate(-90 8.28557 8.28547)"
          stroke="#DCDCDC"
        />
      </G>
      <Path
        d="M8.04834 3.53813L8.04834 9.35352"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11.0483 6.35352L8.04834 9.35352"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
