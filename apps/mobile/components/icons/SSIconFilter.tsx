import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconFilter({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 14">
      <Path
        d="M1 1.5 H15 L9.5 7.5 V12.5 L6.5 11 V7.5 Z"
        fill="none"
        stroke="#adadad"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  )
}
