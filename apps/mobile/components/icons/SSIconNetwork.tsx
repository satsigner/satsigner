import Svg, { Circle, G, Line, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconNetwork({ width, height }: IconProps) {
  return (
    <Svg id="network" width={width} height={height} viewBox="0 0 19 19">
      <G id="Group_7" data-name="Group 7">
        <Circle
          id="Ellipse_11"
          data-name="Ellipse 11"
          cx="9"
          cy="9"
          r="9"
          transform="translate(0.5 0.5)"
          fill="none"
          stroke="#828282"
          strokeWidth="1"
        />
      </G>
      <Line
        id="Line_9"
        data-name="Line 9"
        x1="14"
        y2="9"
        transform="translate(1.27 3.421)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_10"
        data-name="Line 10"
        x1="11"
        y1="2"
        transform="translate(0.911 12.492)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_11"
        data-name="Line 11"
        y1="12"
        x2="4"
        transform="translate(11.526 2.842)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_12"
        data-name="Line 12"
        x1="1.498"
        y1="10.95"
        transform="translate(15.502 3.05)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_13"
        data-name="Line 13"
        x1="10"
        y2="5"
        transform="translate(7.224 13.447)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_14"
        data-name="Line 14"
        x2="4"
        y2="15"
        transform="translate(3.483 2.871)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_15"
        data-name="Line 15"
        x2="13"
        y2="11"
        transform="translate(3.323 2.618)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_16"
        data-name="Line 16"
        x2="10"
        y2="15"
        transform="translate(3.416 2.723)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_17"
        data-name="Line 17"
        x2="13.137"
        y2="3.519"
        transform="translate(4 3)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_18"
        data-name="Line 18"
        y1="8"
        x2="5"
        transform="translate(11.576 6.735)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_19"
        data-name="Line 19"
        x1="3"
        y2="9"
        transform="translate(1.474 3.158)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
      <Line
        id="Line_20"
        data-name="Line 20"
        x2="11"
        y2="0.5"
        transform="translate(4 2.5)"
        fill="none"
        stroke="#fff"
        strokeWidth="1"
      />
    </Svg>
  )
}
