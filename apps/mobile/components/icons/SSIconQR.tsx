import Svg, { Path, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'> & {
  color?: string
}

export default function SSIconQR({
  width,
  height,
  color = '#777777'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 18" fill="none">
      <Rect
        x="1"
        y="1"
        width="6"
        height="6"
        rx="0.5"
        stroke={color}
        strokeWidth="1"
      />
      <Rect x="3" y="3" width="2" height="2" fill={color} />
      <Rect
        x="11"
        y="1"
        width="6"
        height="6"
        rx="0.5"
        stroke={color}
        strokeWidth="1"
      />
      <Rect x="13" y="3" width="2" height="2" fill={color} />
      <Rect
        x="1"
        y="11"
        width="6"
        height="6"
        rx="0.5"
        stroke={color}
        strokeWidth="1"
      />
      <Rect x="3" y="13" width="2" height="2" fill={color} />
      <Path d="M11 11H13V13H11V11Z" fill={color} />
      <Path d="M13 13H15V15H13V13Z" fill={color} />
      <Path d="M15 11H17V13H15V11Z" fill={color} />
      <Path d="M11 15H13V17H11V15Z" fill={color} />
      <Path d="M15 15H17V17H15V15Z" fill={color} />
    </Svg>
  )
}
