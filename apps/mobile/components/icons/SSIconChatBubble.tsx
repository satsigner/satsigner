import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconChatBubble({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 12 12" fill="none">
      <Path
        d="M0.790039 1.36016C0.790039 0.973557 1.10344 0.660156 1.49004 0.660156H10.3283C10.7149 0.660156 11.0283 0.973557 11.0283 1.36016V6.99922C11.0283 7.38582 10.7149 7.69922 10.3283 7.69922H9.72624C9.4501 7.69922 9.22624 7.92308 9.22624 8.19922V10.7541L6.4845 7.91312C6.35258 7.77643 6.17077 7.69922 5.98081 7.69922H1.49004C1.10344 7.69922 0.790039 7.38582 0.790039 6.99922V1.36016Z"
        stroke="#858585"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
