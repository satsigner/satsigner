import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconSuccess({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 159 159" fill="none">
      <Circle cx="79.4999" cy="79.4999" r="79.4999" fill="white" />
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
