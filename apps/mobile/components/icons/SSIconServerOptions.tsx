import Svg, { Path, Rect, type SvgProps } from 'react-native-svg'

type SSIconServerOptionsProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconServerOptions({
  width,
  height
}: SSIconServerOptionsProps) {
  return (
    <Svg
      width={height}
      height={width}
      viewBox="0 0 24 24"
      fill="#000"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect width="20" height="12" x="2" y="6" rx="2" />
      <Path d="M12 12h.01" />
      <Path d="M17 12h.01" />
      <Path d="M7 12h.01" />
    </Svg>
  )
}
