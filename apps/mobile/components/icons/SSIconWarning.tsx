import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'fill' | 'stroke'>

export default function SSIconAbout({
  width,
  height,
  fill = 'yellow',
  stroke = 'black'
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </Svg>
  )
}
