import Svg, { Ellipse, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconGreen({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 21" fill="none">
      <Ellipse cx="10" cy="10.5078" rx="10" ry="10" fill="#4F4F4F" />
      <Ellipse
        cx="10"
        cy="10.3842"
        rx="5.73313"
        ry="5.73313"
        transform="rotate(45 10 10.3842)"
        fill="#A7FFAF"
      />
    </Svg>
  )
}
