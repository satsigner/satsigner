import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<
  SvgProps,
  'width' | 'height' | 'stroke' | 'fill' | 'strokeWidth'
>

export default function SSIconCircleX({
  width,
  height,
  fill = 'none',
  stroke = '#fff',
  strokeWidth = 5
}: IconProps) {
  return (
    <Svg
      id="circle-x"
      width={width}
      height={height}
      viewBox="0 0 88.151 88.151"
    >
      <Circle
        id="Ellipse_4"
        data-name="Ellipse 4"
        cx="41.576"
        cy="41.576"
        r="41.576"
        transform="translate(2.5 2.5)"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <Path
        id="Path_6"
        data-name="Path 6"
        d="M30,57.739,56.394,31"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <Path
        id="Path_7"
        data-name="Path 7"
        d="M56.567,57.566,29.828,31.172"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </Svg>
  )
}
