import Svg, { G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconPasteClipboard({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 10.438">
      <G transform="translate(0 -0.781)">
        <Path
          d="M2.5,1.5h9a1,1,0,0,1,1,1v8.5a1,1,0,0,1-1,1H2.5a1,1,0,0,1-1-1V2.5A1,1,0,0,1,2.5,1.5Z"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
        <Path
          d="M4.5,1.5V1a1,1,0,0,1,1-1h3a1,1,0,0,1,1,1v.5"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
        <Path
          d="M4,4h6"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
        <Path
          d="M4,5.5h4"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
        <Path
          d="M4,7h6"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
        <Path
          d="M4,8.5h5"
          fill="none"
          stroke="rgba(255,255,255,0.73)"
          strokeWidth="1"
        />
      </G>
    </Svg>
  )
}
