import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = {
  variant?: 'filled' | 'outline'
} & Pick<SvgProps, 'width' | 'height' | 'fill'>

export default function SSIconSuccess({
  variant = 'filled',
  width,
  height,
  fill = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="-4 -4 167 167" fill="none">
      <Circle
        cx="79.4999"
        cy="79.4999"
        r="79.4999"
        fill={variant === 'filled' ? fill : undefined}
        stroke={variant === 'outline' ? 'white' : undefined}
        strokeWidth={variant === 'outline' ? 8 : undefined}
        strokeLinecap={variant === 'outline' ? 'round' : undefined}
      />
      <Path
        d="M46.6267 76.8234L69.9627 104.048L110.084 57.2402"
        stroke="#A8A8A8"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  )
}
