import Svg, { Ellipse, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconClose({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Ellipse cx="10" cy="10" rx="9" ry="9" fill="#4F4F4F" />
      <Path d="M13.1696 6.5801L7.0413 12.7083" stroke="white" />
      <Path d="M7.0413 6.5801L13.1695 12.7083" stroke="white" />
    </Svg>
  )
}
