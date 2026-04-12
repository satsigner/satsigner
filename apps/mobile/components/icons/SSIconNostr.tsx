import Svg, {
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
  type SvgProps
} from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

const DEFAULT_SIZE = 22

export default function SSIconNostr({
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
  color = 'white'
}: IconProps) {
  const renderMin =
    typeof width === 'number' &&
    typeof height === 'number' &&
    width > 0 &&
    height > 0
      ? Math.min(width, height)
      : DEFAULT_SIZE
  const strokeWidth = 9 / renderMin
  return (
    <Svg width={width} height={height} viewBox="0 0 9 9" fill="none">
      <Defs>
        <ClipPath id="ssIconNostrClip">
          <Rect width={8.05} height={8.68} fill="white" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#ssIconNostrClip)">
        <Path
          d="M6.6707 3.76083C6.6707 4.85083 5.5707 5.15083 4.2907 5.15083C2.6307 5.15083 1.8307 3.69083 0.220703 3.52083C0.450703 2.60083 2.1907 3.07083 3.2907 2.74083C5.5207 2.07083 6.6707 2.70083 6.6707 3.77083V3.76083Z"
          stroke={color}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M1.65962 8.4707C1.40962 8.1207 1.44962 7.6807 1.44962 7.6807C1.72962 7.3207 2.26962 6.4507 2.40962 6.2707L4.20962 5.2207"
          stroke={color}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M6.7209 3.55966C8.9009 2.85966 5.7809 0.829655 6.5909 0.289655C7.0509 -0.0203446 7.1509 0.639655 7.8409 0.669655"
          stroke={color}
          strokeWidth={strokeWidth}
        />
        <Path
          d="M6.71058 6.5207C6.55058 5.9307 5.94058 6.0707 5.94058 6.0707L3.97058 6.4107C3.92058 6.3607 4.21059 5.4907 4.32059 5.2207"
          stroke={color}
          strokeWidth={strokeWidth}
        />
      </G>
    </Svg>
  )
}
