import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconEyeOff({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21.631 20.121">
      <Path
        id="eye-off"
        d="M3.98,8.223A10.477,10.477,0,0,0,1.934,12a10.516,10.516,0,0,0,12.929,7.1M6.228,6.228A10.5,10.5,0,0,1,22.065,12a10.522,10.522,0,0,1-4.293,5.774M6.228,6.228,3,3M6.228,6.228l3.65,3.65m7.894,7.894L21,21m-3.228-3.228-3.65-3.65m0,0A3,3,0,0,0,9.879,9.879m4.242,4.242L9.88,9.88"
        transform="translate(-1.184 -1.939)"
        fill="none"
        stroke="#828282"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </Svg>
  )
}
