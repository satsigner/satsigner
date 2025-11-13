import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconLNSettings({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24">
      <Path
        d="M18 1L7 13h8l-3 10 9-13h-7z"
        fill="none"
        stroke="#828282"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
