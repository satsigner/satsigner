import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'stroke'>

export default function SSIconEyeOn({
  width,
  height,
  stroke = '#828282'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21.536 16.5">
      <G id="eye-on" transform="translate(-1.232 -3.75)">
        <Path
          id="outer"
          d="M2.036,12.322a1.012,1.012,0,0,1,0-.639,10.5,10.5,0,0,1,19.927,0,1,1,0,0,1,0,.639,10.5,10.5,0,0,1-19.926.005Z"
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <Path
          id="inner"
          d="M15,12a3,3,0,1,1-3-3A3,3,0,0,1,15,12Z"
          fill="none"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </G>
    </Svg>
  )
}
