import Svg, { Circle, G, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconBubbles({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 17.966 16.092">
      <G id="bubbles" transform="translate(-0.774 -0.944)">
        <Circle
          id="Ellipse_5"
          data-name="Ellipse 5"
          cx="4.77"
          cy="4.77"
          r="4.77"
          transform="translate(8.701 1.445)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
        <Circle
          id="Ellipse_6"
          data-name="Ellipse 6"
          cx="2.795"
          cy="2.795"
          r="2.795"
          transform="translate(1.274 4.51)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
        <Circle
          id="Ellipse_7"
          data-name="Ellipse 7"
          cx="2.284"
          cy="2.284"
          r="2.284"
          transform="translate(5.59 11.968)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
