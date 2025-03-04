import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconHalving({
  width = 18,
  height = 17,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 17" fill="none">
      <G filter="url(#filter0_i_1_116)">
        <Circle cx={7.89286} cy={8.50003} r={7.39286} stroke="#DCDCDC" />
      </G>
      <G filter="url(#filter1_i_1_116)">
        <Circle cx={7.8928} cy={8.5} r={3.75} stroke="#DCDCDC" />
      </G>
      <Path
        d="M17.0001 9.10718H9.71441"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
