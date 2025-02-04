import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconExpand({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 15 16">
      <Path
        id="expand1"
        d="M9.05469 0.618164H14.5004V6.50333"
        fill="none"
        stroke="#868686"
      />
      <Path
        id="expand2"
        d="M5.94531 14.6182L0.499635 14.6182L0.499636 8.733"
        fill="none"
        stroke="#868686"
      />
    </Svg>
  )
}
