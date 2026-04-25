import { type SvgProps, Svg, Path } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'height' | 'width' | 'stroke'>

export default function SSIconDelete({
  height,
  width,
  stroke = 'white'
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      stroke={stroke}
      strokeWidth="1"
    >
      <Path d="M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <Path d="m12 9 6 6" />
      <Path d="m18 9-6 6" />
    </Svg>
  )
}
