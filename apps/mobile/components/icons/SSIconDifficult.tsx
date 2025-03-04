import Svg, { Circle, G, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconDifficult({
  width = 17,
  height = 17,
  color = '#DCDCDC'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 17 17" fill="none">
      <G filter="url(#filter0_i_1_108)">
        <Circle cx={8.5} cy={8.5} r={6} stroke={color} />
      </G>
      <G filter="url(#filter1_i_1_108)">
        <Circle cx={8.5} cy={8.5} r={8} stroke={color} />
      </G>
      <G filter="url(#filter2_i_1_108)">
        <Circle cx={8.5} cy={8.5} r={4} stroke={color} />
      </G>
      <G filter="url(#filter3_i_1_108)">
        <Circle cx={8.5} cy={8.5} r={2} stroke={color} />
      </G>
    </Svg>
  )
}
