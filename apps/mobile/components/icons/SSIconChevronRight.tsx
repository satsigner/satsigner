import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

export default function SSIconChevronRight({
  width,
  height,
  stroke = '#828282'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 4.79 11.08">
      <Path
        id="chevron-right"
        d="M1.708.775l3,4.5-3,4.5"
        transform="translate(-0.668 0.265)"
        fill="none"
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </Svg>
  )
}
