import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconIncomingLightning({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 18">
      <G id="incoming-lightning" transform="translate(-0.5)">
        <Path
          id="Path_10"
          data-name="Path 10"
          d="M8.5.5V11m0,0L11,8.5M8.5,11,6,8.5"
          fill="none"
          stroke="#a7ffaf"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
        />
        <Path
          id="Path_11"
          data-name="Path 11"
          d="M4,2a7.5,7.5,0,1,0,9,0"
          fill="none"
          stroke="#a7ffaf"
          strokeWidth="1"
        />
        <Path
          id="Lightning"
          d="M18,2L13.5,9L18,9L13.5,16"
          fill="none"
          stroke="#ffeb3b"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </G>
    </Svg>
  )
}
