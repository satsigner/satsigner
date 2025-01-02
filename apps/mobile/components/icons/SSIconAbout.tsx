import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconAbout({ width, height }: IconProps) {
  return (
    <Svg id="about" width={width} height={height} viewBox="0 0 19 19">
      <G id="circle">
        <Circle
          id="Ellipse_11"
          data-name="Ellipse 11"
          cx="9"
          cy="9"
          r="9"
          transform="translate(0.5 0.5)"
          fill="none"
          stroke="#828282"
          strokeWidth="1"
        />
      </G>
      <Path
        id="i"
        d="M1.984-10.047a.94.94,0,0,0,.938-.937.94.94,0,0,0-.937-.937.94.94,0,0,0-.937.938A.94.94,0,0,0,1.984-10.047ZM1.3,0H2.656V-8.422H1.3Z"
        transform="translate(7.5 15.5)"
        fill="#fff"
      />
    </Svg>
  )
}
