import Svg, { Circle, Line, Path, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconSingleSignature({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 275 125" fill="none">
      <Rect
        x="0.105469"
        y="-0.00390625"
        width="274"
        height="125"
        fill="#1A1A1A"
      />
      <Circle cx="209.105" cy="61.9961" r="29.5" stroke="black" />
      <Circle cx="73.1055" cy="61.9961" r="29.5" stroke="black" />
      <Path
        d="M201.55 56.758V50.9673C201.55 46.5649 204.993 42.9961 209.24 42.9961C213.488 42.9961 216.931 46.5649 216.931 50.9673V56.758"
        stroke="white"
      />
      <Path
        d="M215.312 56.758V51.2407C215.312 47.5816 212.594 44.6152 209.24 44.6152C205.887 44.6152 203.169 47.5816 203.169 51.2407V56.758"
        stroke="white"
      />
      <Rect
        x="198.272"
        y="56.9531"
        width="21.6666"
        height="19.5416"
        rx="0.5"
        stroke="white"
      />
      <Rect
        x="82.6055"
        y="62.4961"
        width="8"
        height="5"
        rx="0.5"
        stroke="white"
      />
      <Rect
        x="54.6055"
        y="55.4961"
        width="8"
        height="12"
        rx="4"
        stroke="white"
      />
      <Rect
        x="56.6055"
        y="59.4961"
        width="2"
        height="4"
        rx="1"
        stroke="white"
      />
      <Rect
        x="62.6055"
        y="60.4961"
        width="30"
        height="2"
        rx="0.5"
        stroke="white"
      />
      <Line
        x1="105.105"
        y1="61.4961"
        x2="177.105"
        y2="61.4961"
        stroke="white"
        strokeDasharray="2 2"
      />
    </Svg>
  )
}
