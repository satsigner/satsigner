import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconMempool({
  width = 22,
  height = 15,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 22 15" fill="none">
      <G>
        <Path
          d="M8.44186 5.5C7.04651 6.16667 3.97674 9.6 1 14H21V5.5L16.3488 1C14.9535 3.83333 12.0698 9.2 11.6977 8C11.3256 6.8 9.37209 5.83333 8.44186 5.5Z"
          stroke={color}
          strokeLinecap="round"
        />
        <Path
          d="M1 14H21M3.5 10.5C4.43023 10.6795 9 8.5 11.6977 10.7692C12.2683 11.2492 14.9535 8.52564 16.3488 7L21 9.42308"
          stroke={color}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  )
}
