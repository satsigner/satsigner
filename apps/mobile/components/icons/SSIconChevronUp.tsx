import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconChevronUp({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 11.08 4.79">
      <Path
        id="chevron-up"
        d="M10.333,4.407l-4.5-3-4.5,3"
        transform="translate(-0.293 -0.657)"
        fill="none"
        stroke="#828282"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </Svg>
  )
}