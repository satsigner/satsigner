import Svg, { Circle, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<
  SvgProps,
  'width' | 'height' | 'fill' | 'stroke' | 'strokeWidth'
> & {
  strokeTriangle?: SvgProps['stroke']
  strokeExclamation?: SvgProps['stroke']
  strokeWidthTriangle?: SvgProps['strokeWidth']
  strokeWidthExclamation?: SvgProps['strokeWidth']
}

export default function SSIconWarning({
  width,
  height,
  fill = 'none',
  stroke = '#F2C94C',
  strokeWidth = 1,
  strokeTriangle,
  strokeExclamation,
  strokeWidthTriangle,
  strokeWidthExclamation = 1
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        fill={fill}
        stroke={strokeTriangle || stroke}
        strokeWidth={strokeWidthTriangle || strokeWidth}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
      />
      <Path
        stroke={strokeExclamation || stroke}
        strokeWidth={strokeWidthExclamation || strokeWidth}
        strokeLinecap="round"
        d="M12 9v4"
      />
      <Circle cx={12} cy={17} r={0.75} fill={strokeExclamation || stroke} />
    </Svg>
  )
}
