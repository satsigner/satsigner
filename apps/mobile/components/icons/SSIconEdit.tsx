import Svg, { Ellipse, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconEdit({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 20 20" fill="none">
      <Ellipse cx="10" cy="10" rx="10" ry="10" fill="#4F4F4F" />
      <Path
        d="M13.3818 7.70312L11.6783 5.99963L6.88728 10.7907L6.85179 12.5297L8.59077 12.4942L13.3818 7.70312Z"
        fill="#D9D9D9"
      />
    </Svg>
  )
}
