import Svg, { Circle, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'fill' | 'stroke'> & {
  size: SvgProps['height']
}

export default function SSIconCircle({ size, fill, stroke }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx="12" cy="12" r="10" />
    </Svg>
  )
}
