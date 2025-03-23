import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconConverterActive({
  width = 20,
  height = 22,
  color = 'white',
  strokeColor = 'black'
}: IconProps & { strokeColor?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 22" fill="none">
      <Circle
        cx="10"
        cy="11"
        r="8"
        fill={color}
        stroke={color}
        strokeWidth="3"
      />
      <Circle cx="10" cy="11" r="7" stroke={strokeColor} />
      <Path
        d="M8 15L11 18L8 21"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 7L8 4L11 1"
        stroke={strokeColor}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
