import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconExplorerActive({
  width = 28,
  height = 16,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 28 16" fill="none">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M14 12.228a7.724 7.724 0 1 1 0-9.008 7.724 7.724 0 1 1 0 9.008Z"
        clipRule="evenodd"
      />
    </Svg>
  )
}
