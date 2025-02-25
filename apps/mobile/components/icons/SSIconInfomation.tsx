import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconInformation({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 15" fill="none">
      <Path
        d="M6.15008 10.2897H6.8291V6.35147H6.15008V5.67245H7.64391V10.2897H8.32292V10.9688H6.15008V10.2897ZM6.59823 4.23295C6.59823 4.04282 6.64803 3.89797 6.74761 3.79838C6.85626 3.68974 7.00111 3.63542 7.18218 3.63542C7.3542 3.63542 7.49453 3.68974 7.60317 3.79838C7.71181 3.89797 7.76613 4.03377 7.76613 4.20579C7.76613 4.38686 7.71181 4.53171 7.60317 4.64035C7.49453 4.73994 7.34967 4.78974 7.1686 4.78974C6.99659 4.78974 6.85626 4.73994 6.74761 4.64035C6.64803 4.53171 6.59823 4.39591 6.59823 4.23295Z"
        fill="white"
      />
      <Circle
        cx="7.16797"
        cy="7.46875"
        r="6.28164"
        stroke="white"
        strokeWidth="0.8"
      />
    </Svg>
  )
}
