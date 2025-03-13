import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconChainTip({
  width = 30,
  height = 13,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 30 13" fill="none">
      <G opacity={0.24}>
        <Path
          d="M1.0002 5.0011H6.622V10.2481H1.0002V5.0011Z"
          stroke={color}
          strokeLinejoin="round"
        />
        <Path
          d="M3.06133 2.75214H8.68313L6.6218 5.00086H1L3.06133 2.75214Z"
          stroke={color}
          strokeLinejoin="round"
        />
        <Path
          d="M8.68323 7.99924V2.75223L6.6219 5.00095V10.248L8.68323 7.99924Z"
          stroke={color}
          strokeLinejoin="round"
        />
      </G>
      <G opacity={0.35}>
        <Path
          d="M8.6748 4.78802H15.2784V10.9514H8.6748V4.78802Z"
          stroke={color}
          strokeLinejoin="round"
        />
        <Path
          d="M11.0961 2.14624H17.6997L15.2784 4.78767H8.6748L11.0961 2.14624Z"
          stroke={color}
          strokeLinejoin="round"
        />
        <Path
          d="M17.7 8.30957V2.14624L15.2787 4.78767V10.951L17.7 8.30957Z"
          stroke={color}
          strokeLinejoin="round"
        />
      </G>
      <Path
        d="M17.479 4.32974H25.8019V12.0978H17.479V4.32974Z"
        fill="#272727"
        stroke={color}
        strokeLinejoin="round"
      />
      <Path
        d="M20.5307 1H28.8537L25.8019 4.32918H17.479L20.5307 1Z"
        fill="#272727"
        stroke={color}
        strokeLinejoin="round"
      />
      <Path
        d="M28.8536 8.76808V1L25.8018 4.32918V12.0973L28.8536 8.76808Z"
        fill="#272727"
        stroke={color}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
