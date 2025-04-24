import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<
  SvgProps,
  'width' | 'height' | 'fill' | 'stroke' | 'strokeWidth'
>

export default function SSIconWarningSharp({
  width = 93,
  height = 82,
  fill = 'none',
  stroke = 'white',
  strokeWidth = 3,
  ...rest
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 93 82"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      {...rest}
    >
      <Path
        d="M43.069 3.758c1.347-2.334 4.715-2.334 6.062 0l41.02 71.05c1.348 2.334-.336 5.25-3.03 5.25H5.078c-2.694 0-4.378-2.916-3.03-5.25l41.02-71.05Z"
        fill="#000"
        fillOpacity={0.5}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <Path
        d="m44.96 55.336-.257-21.078h3.204l-.235 21.078H44.96Zm1.345 10.058c-1.388 0-2.392-1.004-2.392-2.392 0-1.409 1.004-2.413 2.392-2.413 1.41 0 2.392 1.004 2.392 2.413 0 1.389-.983 2.392-2.392 2.392Z"
        fill="#fff"
      />
    </Svg>
  )
}
