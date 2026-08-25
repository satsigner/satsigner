import Svg, { Line, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

const GRAY = '#828282'
const WHITE = '#fff'

export default function SSIconSeed({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={21} x2={19} y2={21} stroke={GRAY} strokeWidth={1} />
      <Path
        d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3"
        stroke={GRAY}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4"
        stroke={WHITE}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
