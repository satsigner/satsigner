import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconBlock({
  width = 18,
  height = 17,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 17" fill="none">
      <G id="block">
        <Path
          d="M1.01221 5.38086H12.7106V16.2993H1.01221V5.38086Z"
          stroke={color}
          strokeLinejoin="round"
        />
        <Path
          d="M5.3016 0.701172H17L12.7106 5.38051H1.01221L5.3016 0.701172Z"
          stroke={color}
          strokeLinejoin="round"
        />
        <Path
          d="M16.9998 11.6196V0.701172L12.7104 5.38051V16.299L16.9998 11.6196Z"
          stroke={color}
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  )
}
