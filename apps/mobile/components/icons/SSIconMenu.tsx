import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconMenu({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 13 10" fill="none">
      <Path d="M4.10547 1H12.1055" stroke="#828282" />
      <Path d="M4.10547 5H12.1055" stroke="#828282" />
      <Path d="M4.10547 9H12.1055" stroke="#828282" />
      <Path d="M2.10547 1H0.105469" stroke="#828282" />
      <Path d="M2.10547 5H0.105469" stroke="#828282" />
      <Path d="M2.10547 9H0.105469" stroke="#828282" />
    </Svg>
  )
}
