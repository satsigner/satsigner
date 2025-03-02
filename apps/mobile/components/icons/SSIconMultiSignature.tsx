import Svg, { Circle, Path, Rect, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconMultiSignature({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 275 161" fill="none">
      <Rect
        x="0.105469"
        y="-0.00390625"
        width="274"
        height="161"
        fill="#1A1A1A"
      />
      <Circle cx="215.105" cy="80.9961" r="29.5" stroke="black" />
      <Circle cx="51.1055" cy="33.9961" r="22.5" stroke="black" />
      <Rect
        x="58.5054"
        y="34.4961"
        width="5.9"
        height="3.6"
        rx="0.5"
        stroke="white"
      />
      <Rect
        x="37.0388"
        y="29.1289"
        width="5.9"
        height="8.96667"
        rx="2.95"
        stroke="white"
      />
      <Rect
        x="38.5723"
        y="32.1953"
        width="1.3"
        height="2.83333"
        rx="0.65"
        stroke="white"
      />
      <Rect
        x="43.1721"
        y="32.9609"
        width="22.7667"
        height="1.3"
        rx="0.5"
        stroke="white"
      />
      <Circle cx="51.1055" cy="82.9961" r="22.5" stroke="black" />
      <Rect
        x="58.5054"
        y="83.4961"
        width="5.9"
        height="3.6"
        rx="0.5"
        stroke="white"
      />
      <Rect
        x="37.0388"
        y="78.1289"
        width="5.9"
        height="8.96667"
        rx="2.95"
        stroke="white"
      />
      <Rect
        x="38.5723"
        y="81.1953"
        width="1.3"
        height="2.83333"
        rx="0.65"
        stroke="white"
      />
      <Rect
        x="43.1721"
        y="81.9609"
        width="22.7667"
        height="1.3"
        rx="0.5"
        stroke="white"
      />
      <Circle cx="51.1055" cy="131.996" r="22.5" stroke="black" />
      <Rect
        x="58.5054"
        y="132.496"
        width="5.9"
        height="3.6"
        rx="0.5"
        stroke="white"
        strokeOpacity="0.2"
      />
      <Rect
        x="37.0388"
        y="127.129"
        width="5.9"
        height="8.96667"
        rx="2.95"
        stroke="white"
        strokeOpacity="0.2"
      />
      <Rect
        x="38.5723"
        y="130.195"
        width="1.3"
        height="2.83333"
        rx="0.65"
        stroke="white"
        strokeOpacity="0.2"
      />
      <Rect
        x="43.1721"
        y="130.961"
        width="22.7667"
        height="1.3"
        rx="0.5"
        stroke="white"
        strokeOpacity="0.2"
      />
      <Path
        d="M207.55 75.758V69.9673C207.55 65.5649 210.993 61.9961 215.24 61.9961C219.488 61.9961 222.931 65.5649 222.931 69.9673V75.758"
        stroke="white"
      />
      <Path
        d="M221.312 75.758V70.2407C221.312 66.5816 218.594 63.6152 215.24 63.6152C211.887 63.6152 209.169 66.5816 209.169 70.2407V75.758"
        stroke="white"
      />
      <Rect
        x="204.272"
        y="75.9531"
        width="21.6666"
        height="19.5416"
        rx="0.5"
        stroke="white"
      />
      <Path
        d="M137.105 80.4961L183.105 80.4961M137.105 80.4961L137.105 33.9961L78.6055 33.9961M137.105 80.4961L81.1055 80.4961"
        stroke="white"
        strokeDasharray="2 2"
      />
    </Svg>
  )
}
