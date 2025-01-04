import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconRefresh({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 12 14.843">
      <G id="refresh" transform="translate(-0.5 -0.316)">
        <Path
          id="Path_13"
          data-name="Path 13"
          d="M1,9.159A5.5,5.5,0,1,0,2.719,5.165"
          fill="none"
          stroke="#828282"
          strokeWidth="1"
        />
        <Path
          id="Path_14"
          data-name="Path 14"
          d="M7,6.952,2.405,5.1,4.225.5"
          fill="none"
          stroke="#828282"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
