import Svg, { Circle, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconEllipsis({ width = 11, height = 3 }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 11 3" fill="none">
      <Circle cx="9.48926" cy="1.5" r="1" fill="#D9D9D9" />
      <Circle cx="5.48926" cy="1.5" r="1" fill="#D9D9D9" />
      <Circle cx="1.48926" cy="1.5" r="1" fill="#D9D9D9" />
    </Svg>
  )
}
