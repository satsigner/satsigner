import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconScanNFC({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 10.438">
      <G id="scan-nfc" transform="translate(2 -2.5)">
        <Path
          id="scan-waves"
          data-name="scan-waves"
          d="M5.68275,1.35547C9.101,4.77372,9.101,10.3158,5.68275,13.7341M3.21165,3.81793C5.26816,5.87444,5.26816,9.20869,3.21165,11.2652M0.969727,6.05474C1.7916,6.87661,1.7916,8.20913,0.969727,9.031"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </G>
    </Svg>
  )
}
