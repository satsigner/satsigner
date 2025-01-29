import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconChartWhite({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 26 15" fill="none">
      <Path
        d="M0.0114746 14.3499H6.26379V3.04432H13.6884V9.4344H16.6192V0.621633L19.9163 0.621582V4.64178H25.0452"
        stroke="white"
      />
    </Svg>
  )
}
