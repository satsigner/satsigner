import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconChevronLeft({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 4.79 11.08">
      <Path
        id="chevron-left"
        d="M4,10.5,1,6,4,1.5"
        transform="translate(-0.25 -0.46)"
        fill="none"
        stroke="#828282"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
      />
    </Svg>
  )
}
