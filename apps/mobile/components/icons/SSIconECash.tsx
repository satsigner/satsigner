import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconECash({
  width = 16,
  height = 18,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 18" fill="none">
      <G id="ecash">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5.70323 1.20333C7.41163 1.84838 8.30174 3.83486 7.69136 5.64026C7.43845 6.3883 7.56496 7.64599 8.3266 8.72629C9.00953 9.69495 9.98186 10.2147 11.2024 10.0111C12.9943 9.71209 14.6764 11.0049 14.9593 12.8986C15.2423 14.7923 14.019 16.5698 12.227 16.8688C8.24644 17.533 4.97583 15.5939 3.05839 12.8743C1.21966 10.2663 0.388367 6.60622 1.5047 3.30434C2.11508 1.49894 3.99483 0.558283 5.70323 1.20333Z"
          stroke={color}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  )
}
