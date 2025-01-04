import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconPencil({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 8 7" fill="none">
      <Path
        d="M7.38184 1.70312L5.67834 -0.000366361L0.887275 4.7907L0.851786 6.52968L2.59077 6.49419L7.38184 1.70312Z"
        fill="#D9D9D9"
      />
    </Svg>
  )
}
