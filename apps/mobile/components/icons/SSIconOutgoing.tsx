import Svg, { G, Path, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconOutgoing({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 15 15.707">
      <G id="outgoing" transform="translate(0 0.207)">
        <Rect
          id="Rectangle_67"
          data-name="Rectangle 67"
          width="14"
          height="4"
          transform="translate(0.5 11)"
          fill="none"
          stroke="#ff7171"
          strokeLinejoin="round"
          strokeWidth="1"
        />
        <Path
          id="Path_12"
          data-name="Path 12"
          d="M7.5,8.5V.5m0,0L5,3M7.5.5,10,3"
          fill="none"
          stroke="#ff7171"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
