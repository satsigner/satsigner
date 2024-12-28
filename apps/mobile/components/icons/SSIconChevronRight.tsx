import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconChevronRight({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 4.79 11.08">
      <Path
        id="chevron-right"
        d="M1.708.775l3,4.5-3,4.5"
        transform="translate(-0.668 0.265)"
        fill="none"
        stroke="#828282"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </Svg>
  )
}
