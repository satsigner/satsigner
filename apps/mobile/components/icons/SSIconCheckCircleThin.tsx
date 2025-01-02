import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconCheckCircleThin({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 35 35">
      <G id="check-circle-thin" transform="translate(-0.5 -0.5)">
        <Circle
          id="Ellipse_10"
          data-name="Ellipse 10"
          cx="17"
          cy="17"
          r="17"
          transform="translate(1 1)"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
        <Path
          id="Path_33"
          data-name="Path 33"
          d="M6.7,15.038l4.208,4.04L22.017,7.8"
          transform="translate(3.894 4.645)"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
