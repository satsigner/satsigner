import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<
  SvgProps,
  'width' | 'height' | 'fill' | 'stroke' | 'strokeWidth'
> & {
  strokeTriangle?: SvgProps['stroke']
  strokeExclamation?: SvgProps['stroke']
  strokeWidthTriangle?: SvgProps['strokeWidth']
  strokeWidthExclamation?: SvgProps['strokeWidth']
}

export default function SSIconAbout({
  width,
  height,
  fill = 'yellow',
  stroke = 'black',
  strokeWidth = 1,
  strokeTriangle,
  strokeExclamation,
  strokeWidthTriangle,
  strokeWidthExclamation = 2
}: IconProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={fill}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path
        stroke={strokeTriangle || stroke}
        strokeWidth={strokeWidthTriangle || strokeWidth}
        d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
      />
      <Path
        stroke={strokeExclamation || stroke}
        strokeWidth={strokeWidthExclamation || strokeWidth}
        d="M12 9v4"
      />
      <Path
        stroke={strokeExclamation || stroke}
        strokeWidth={strokeWidthExclamation || strokeWidth}
        d="M12 17h.01"
      />
    </Svg>
  )
}
