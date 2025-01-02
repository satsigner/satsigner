import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconCamera({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 10.438">
      <G id="camera" transform="translate(0 -0.781)">
        <Path
          id="Path_8"
          data-name="Path 8"
          d="M13.5,2.847v7.873H.5V2.847H3.267a1.618,1.618,0,0,0,1.326-.677h0l.625-.888H9.106l.625.888a1.618,1.618,0,0,0,1.326.677Z"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
        <Path
          id="Path_9"
          data-name="Path 9"
          d="M7,4A2.5,2.5,0,1,1,4.5,6.5,2.5,2.5,0,0,1,7,4Z"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
