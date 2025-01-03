import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconX({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 8.107 8.107">
      <G id="x" transform="translate(-0.947 -0.946)">
        <Path
          id="Path_28"
          data-name="Path 28"
          d="M8.7,1.3,1.3,8.7"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
        <Path
          id="Path_29"
          data-name="Path 29"
          d="M1.3,1.3,8.6,8.6"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
