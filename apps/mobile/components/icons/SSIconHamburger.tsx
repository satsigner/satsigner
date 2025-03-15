import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconHamburger({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 10" fill="none">
      <G id="hamburger" transform="translate(-2.596 -2.25)">
        <Path d="M0 1H14" stroke="#FFFFFF" opacity="0.6" />
        <Path d="M0 6H14" stroke="#FFFFFF" opacity="0.6" />
        <Path d="M0 11H14" stroke="#FFFFFF" opacity="0.6" />
      </G>
    </Svg>
  )
}
