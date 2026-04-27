import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconInfo({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24">
      <Circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="white"
        strokeWidth={2}
      />
      <Path
        d="M12 16v-4"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 8h.01"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  )
}
