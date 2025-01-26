import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconCollapse({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 15 15">
      <Path
        id="collapse1"
        d="M14.7402 5.71777L9.97461 5.71777L9.97461 0.618603"
        fill="none"
        stroke="#868686"
      />
      <Path
        id="collapse2"
        d="M0.740234 9.51855H5.50586L5.50586 14.6177"
        fill="none"
        stroke="#868686"
      />
    </Svg>
  )
}
