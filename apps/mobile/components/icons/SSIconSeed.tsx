import Svg, { Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'height' | 'width'>

export default function SSIconSeed({ height, width }: IconProps) {
  return (
    <>
      <Svg
        width={width}
        height={height}
        viewBox="0 0 24 24"
        stroke="#fff"
        fill="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
        <Path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
        <Path d="M5 21h14" />
      </Svg>
    </>
  )
}
