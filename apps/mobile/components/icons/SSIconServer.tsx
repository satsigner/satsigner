import Svg, { Line, Rect, type SvgProps } from 'react-native-svg'

type SSIconServerProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconServer({ width, height }: SSIconServerProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="#000"
      stroke="#fff"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <Rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <Line x1="6" x2="6.01" y1="6" y2="6" />
      <Line x1="6" x2="6.01" y1="18" y2="18" />
    </Svg>
  )
}
