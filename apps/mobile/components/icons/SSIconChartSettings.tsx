import Svg, { Circle, Line, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconChartSettings({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21 17" fill="none">
      <Path
        d="M11.9155 3.37871L10.7919 2.25517C10.0244 2.62001 9.59562 2.93126 8.9692 2.67164C8.34523 2.41301 8.26312 1.89673 7.97597 1.08887H6.3868C6.10063 1.89279 6.01852 2.41252 5.39406 2.67164C4.76911 2.93126 4.34527 2.62346 3.57084 2.25517L2.44731 3.37871C2.81363 4.14969 3.1234 4.5755 2.86378 5.20143C2.60466 5.82638 2.08493 5.90849 1.28101 6.19466V7.78383C2.08346 8.06901 2.60466 8.15211 2.86378 8.77657C3.12438 9.40692 2.80773 9.84158 2.44731 10.5993L3.57084 11.7233C4.33888 11.358 4.76764 11.0472 5.39357 11.3068C6.01802 11.5655 6.10014 12.0832 6.3868 12.8896H7.97597"
        stroke="#828282"
        strokeLinecap="round"
      />
      <Circle
        cx="13.6528"
        cy="9.53879"
        r="4.46359"
        fill="#131313"
        stroke="#828282"
        strokeLinecap="round"
      />
      <Line
        x1="17.3521"
        y1="13.0557"
        x2="19.8581"
        y2="15.5616"
        stroke="#828282"
        strokeLinecap="round"
      />
    </Svg>
  )
}
