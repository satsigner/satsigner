import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

const VIEW = 12

export default function SSIconContacts({
  width,
  height,
  color = '#858585'
}: IconProps) {
  const renderMin =
    typeof width === 'number' &&
    typeof height === 'number' &&
    width > 0 &&
    height > 0
      ? Math.min(width, height)
      : VIEW
  const strokeWidth = VIEW / renderMin
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
    >
      <Path
        d="M4 3.5 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M1.5 11.5 C1.5 8.5 3.5 7 6 7 C8.5 7 10.5 8.5 10.5 11.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  )
}
