import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconFeature({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <G opacity="0.5">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M20.2034 23.2861L13.1787 16.2615L16.1506 13.2896L23.1753 20.3142L20.2034 23.2861Z"
          stroke="white"
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M14.455 17.3134L13.2913 16.1497L16.0381 13.4028L17.2018 14.5666L14.455 17.3134Z"
          stroke="white"
        />
        <Circle cx="9.06675" cy="8.81968" r="8.05161" stroke="white" />
      </G>
    </Svg>
  )
}
