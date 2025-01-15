import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconChart({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 17 10" fill="none">
      <Path
        d="M0.605469 9.00007H4.47669V2.00007H9.07376V5.9566H10.8884V0.500031L12.9299 0.5V2.98917H16.1055"
        stroke="#828282"
      />
    </Svg>
  )
}
