import Svg, { Circle, Line, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconKeys({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21 19" fill="none">
      <Circle
        cx="17.1678"
        cy="6.62321"
        r="2.03591"
        transform="rotate(-95.3805 17.1678 6.62321)"
        stroke="#3B3B3B"
      />
      <Line
        x1="17.6497"
        y1="9.12499"
        x2="18.4602"
        y2="17.731"
        stroke="#3B3B3B"
      />
      <Rect
        x="18.3454"
        y="16.5149"
        width="1.31116"
        height="1.28932"
        transform="rotate(-95.3805 18.3454 16.5149)"
        fill="#353535"
        stroke="#3B3B3B"
      />
      <Circle
        cx="14.2441"
        cy="5.50839"
        r="2.30171"
        transform="rotate(-70.6518 14.2441 5.50839)"
        stroke="#646464"
      />
      <Line
        x1="13.5221"
        y1="8.22425"
        x2="10.358"
        y2="17.2351"
        stroke="#646464"
      />
      <Rect
        x="10.7414"
        y="16.1431"
        width="1.943"
        height="1.91519"
        transform="rotate(-70.6518 10.7414 16.1431)"
        fill="#636363"
        stroke="#646464"
      />
      <Circle
        cx="12.0131"
        cy="4.62102"
        r="2.76768"
        transform="rotate(-44.5529 12.0131 4.62102)"
        stroke="#858585"
      />
      <Line
        x1="9.82198"
        y1="7.05259"
        x2="2.4297"
        y2="14.3304"
        stroke="#858585"
      />
      <Rect
        x="3.09966"
        y="13.6706"
        width="2.44171"
        height="2.49333"
        transform="rotate(-44.5529 3.09966 13.6706)"
        fill="#858585"
        stroke="#858585"
      />
    </Svg>
  )
}
