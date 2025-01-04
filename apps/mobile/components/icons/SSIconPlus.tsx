import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconPlus({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 8.667 8.666">
      <G id="plus" transform="translate(-0.667 -0.667)">
        <Path
          id="Path_26"
          data-name="Path 26"
          d="M5,.667V9.333"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
        <Path
          id="Path_27"
          data-name="Path 27"
          d="M.667,5H9.333"
          fill="none"
          stroke="#fff"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
