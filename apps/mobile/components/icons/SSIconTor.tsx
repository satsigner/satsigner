import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'> & { color?: string }

export default function SSIconTor({
  width,
  height,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21a7 7 0 0 0 7-7c0-3.3-2.4-5.6-5-6.6C13 5.8 13.6 4 15 3c-2.6.4-4 2-4.3 4.2C7.4 8 5 10.6 5 14a7 7 0 0 0 7 7Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M12 18a4 4 0 0 0 4-4c0-2-1.4-3.4-3-4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 15.5a1.5 1.5 0 0 0 1.5-1.5c0-.8-.5-1.3-1-1.6"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  )
}
