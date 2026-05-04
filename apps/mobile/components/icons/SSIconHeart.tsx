import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'> & {
  color?: string
  filled?: boolean
}

export default function SSIconHeart({
  width,
  height,
  color = '#777777',
  filled = false
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 18 16" fill="none">
      <Path
        d="M9 14.5C9 14.5 1.5 9.5 1.5 5C1.5 2.79 3.29 1 5.5 1C7 1 8.29 1.84 9 3.07C9.71 1.84 11 1 12.5 1C14.71 1 16.5 2.79 16.5 5C16.5 9.5 9 14.5 9 14.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
