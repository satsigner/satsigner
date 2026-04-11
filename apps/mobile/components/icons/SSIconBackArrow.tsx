import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

const VIEW = 24

export default function SSIconBackArrow({
  width = 24,
  height = 24,
  stroke = '#828282'
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
    >
      <Path
        d="M14 19.5L8.5 12L14 4.5"
        stroke={stroke}
        strokeWidth={1}
      />
    </Svg>
  )
}
