import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'> & {
  color?: string
  filled?: boolean
}

export default function SSIconBookmark({
  width,
  height,
  color = '#ffffff',
  filled
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 20">
      <Path
        d="M2 1 L14 1 L14 18 L8 13 L2 18 Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
