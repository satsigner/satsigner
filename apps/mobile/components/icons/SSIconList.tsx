import Svg, { G, Line, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconList({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16.36 9.65">
      <G id="list" transform="translate(0 -3.56)">
        <Line
          id="Line_3"
          data-name="Line 3"
          x2="10.51"
          transform="translate(5.85 4.06)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
        <Line
          id="Line_4"
          data-name="Line 4"
          x2="3.37"
          transform="translate(0 4.06)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
        <Line
          id="Line_5"
          data-name="Line 5"
          x2="10.51"
          transform="translate(5.85 8.38)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
        <Line
          id="Line_6"
          data-name="Line 6"
          x2="3.37"
          transform="translate(0 8.38)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
        <Line
          id="Line_7"
          data-name="Line 7"
          x2="10.51"
          transform="translate(5.85 12.71)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
        <Line
          id="Line_8"
          data-name="Line 8"
          x2="3.37"
          transform="translate(0 12.71)"
          fill="none"
          stroke="#adadad"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
