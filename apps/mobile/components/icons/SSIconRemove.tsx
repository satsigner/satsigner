import Svg, { Ellipse, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconRemove({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21 21" fill="none">
      <Ellipse cx="10.6055" cy="10.2949" rx="10" ry="10" fill="#EB5757" />
      <Path d="M14.272 6.62793L6.93864 13.9613" stroke="white" />
      <Path d="M6.93848 6.62793L14.2718 13.9613" stroke="white" />
    </Svg>
  )
}
