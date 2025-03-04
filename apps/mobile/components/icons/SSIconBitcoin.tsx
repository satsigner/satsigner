import Svg, { Circle, Defs, G, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconBitcoin({ width = 22, height = 22 }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 22 22" fill="none">
      <G filter="url(#filter0_i_8288_24201)">
        <Circle cx={11} cy={11} r={11} fill="#fff" />
      </G>
      <Circle cx={11} cy={11} r={10.5} stroke="#DCDCDC" />
      <Defs />
    </Svg>
  )
}
