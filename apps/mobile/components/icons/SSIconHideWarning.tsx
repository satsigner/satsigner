import Svg, { Circle, G, Line, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconHideWarning({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 171.1 108.126">
      <G id="hide-warning" transform="translate(-0.979 -0.487)">
        <Path
          id="Path_3"
          data-name="Path 3"
          d="M3.1,58.2c.1-.1.3-.2.4-.4,1.1-1,2.7-2.3,4.9-4a165.452,165.452,0,0,1,17.9-12c15.2-8.8,36-17.4,59-17.4s43.8,8.7,59,17.4a155.959,155.959,0,0,1,17.9,12c2.1,1.6,3.8,3,4.9,4,.2.1.3.3.4.4-.1.1-.3.2-.4.4-1.1,1-2.7,2.3-4.9,4a165.451,165.451,0,0,1-17.9,12c-15.2,8.8-36,17.4-59,17.4s-43.8-8.7-59-17.4a155.959,155.959,0,0,1-17.9-12c-2.1-1.6-3.8-3-4.9-4Z"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
        />
        <G id="Group_4" data-name="Group 4">
          <Circle
            id="Ellipse_2"
            data-name="Ellipse 2"
            cx="37"
            cy="37"
            r="37"
            transform="translate(47.5 17.9)"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
          />
          <Circle
            id="Ellipse_3"
            data-name="Ellipse 3"
            cx="13.4"
            cy="13.4"
            r="13.4"
            transform="translate(71.1 41.5)"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
          />
        </G>
        <Line
          id="Line_1"
          data-name="Line 1"
          y1="99.3"
          x2="107.8"
          transform="translate(30.9 4.9)"
          fill="none"
          stroke="#000"
          strokeWidth="12"
        />
        <Line
          id="Line_2"
          data-name="Line 2"
          y1="99.3"
          x2="107.9"
          transform="translate(30.1 5.1)"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
        />
        <Path
          id="Path_4"
          data-name="Path 4"
          d="M137.9,59.8a6.007,6.007,0,0,1,10.4,0L169.2,96a6.011,6.011,0,0,1-5.2,9H122.2a6.011,6.011,0,0,1-5.2-9Z"
          fill="#fff"
          stroke="#000"
          strokeWidth="4"
        />
        <Path
          id="Path_5"
          data-name="Path 5"
          d="M141.6,88l-.3-12.3h4.1L145,88Zm1.7,6.4a2.109,2.109,0,1,1,2.3-2.1A2.054,2.054,0,0,1,143.3,94.4Z"
        />
      </G>
    </Svg>
  )
}
