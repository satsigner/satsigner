import Svg, { Ellipse, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconAdd({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 27 27" fill="none">
      <Ellipse cx="13.1055" cy="13.3027" rx="10" ry="10" fill="#4F4F4F" />
      <G opacity="0.56">
        <Path d="M13.1055 8.96875V17.6354" stroke="white" />
        <Path d="M8.77209 13.3027L17.4388 13.3027" stroke="white" />
      </G>
    </Svg>
  )
}
