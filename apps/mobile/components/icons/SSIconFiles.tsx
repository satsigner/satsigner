import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

const VIEW = 12

export default function SSIconFiles({
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
        d="M2 1 H7.5 L10.5 4 V11 H2 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M7.5 1 V4 H10.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M4 6 H8.5 M4 7.5 H8.5 M4 9 H7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  )
}
