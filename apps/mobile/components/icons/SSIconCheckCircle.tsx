import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconCheckCircle({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 22.2 22.2">
      <Circle
        cx="10.1"
        cy="10.1"
        r="10.1"
        transform="translate(1 1)"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      />
      <Path
        d="M6.7,12.1l2.5,2.4,6.6-6.7"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      />
    </Svg>
  )
}
