import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconCircleXThin({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 35 35">
      <G id="circle-x-thin" transform="translate(-2 -2)">
        <Circle
          id="Ellipse_4"
          data-name="Ellipse 4"
          cx="17"
          cy="17"
          r="17"
          transform="translate(2.5 2.5)"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
        <Path
          id="Path_6"
          data-name="Path 6"
          d="M30,41.933,40.792,31"
          transform="translate(-16.255 -16.847)"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
        <Path
          id="Path_7"
          data-name="Path 7"
          d="M40.761,41.964,29.828,31.172"
          transform="translate(-16.154 -16.948)"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
