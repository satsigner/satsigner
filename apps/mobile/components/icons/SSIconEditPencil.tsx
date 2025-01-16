import Svg, { Circle, Path, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconEditPencil({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 18" fill="none">
      <Rect
        x="14.1382"
        y="1.40663"
        width="4"
        height="10.7002"
        transform="rotate(37.815 14.1382 1.40663)"
        stroke="#AAAAAA"
      />
      <Path
        d="M7.59039 9.84413L10.7504 12.2966L10.0377 13.2149L7.17957 14.3363C6.82675 14.4747 6.4542 14.1856 6.50074 13.8094L6.87768 10.7625L7.59039 9.84413Z"
        stroke="#AAAAAA"
      />
      <Path
        d="M11.765 15.3985L11.765 17.2949H0.6521L0.6521 4.15887L6.04017 2.4751L9.51281 3.40804"
        stroke="#6C6C6C"
        stroke-linecap="round"
      />
      <Circle
        cx="6.13257"
        cy="6.56177"
        r="1.30542"
        stroke="#6C6C6C"
        stroke-linecap="round"
      />
    </Svg>
  )
}
