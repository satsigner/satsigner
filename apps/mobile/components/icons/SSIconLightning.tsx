import Svg, { G, Mask, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconLightning({
  width = 16,
  height = 20,
  color = 'white'
}: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 20" fill="none">
      <G id="lightning">
        <Mask id="mask0" fill={color}>
          <Path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.80782 8.35964L10.0424 0L0 11.6933H6.04126L5.80933 20L15.7566 8.35964H9.80782Z"
          />
        </Mask>
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.80782 8.35964L10.0424 0L0 11.6933H6.04126L5.80933 20L15.7566 8.35964H9.80782Z"
          fill="black"
        />
        <Path
          d="M10.0424 0L11.042 0.028L11.1211 -2.7909L9.28377 -0.651524L10.0424 0ZM9.80782 8.35964L8.80821 8.33159L8.77937 9.35964H9.80782V8.35964ZM0 11.6933L-0.758628 11.0418L-2.17699 12.6933H0V11.6933ZM6.04126 11.6933L7.04087 11.7212L7.06957 10.6933H6.04126V11.6933ZM5.80933 20L4.80972 19.9721L4.73071 22.8015L6.56956 20.6497L5.80933 20ZM15.7566 8.35964L16.5168 9.00929L17.9265 7.35964L15.7566 7.35964V8.35964ZM9.04279 -0.0280498L8.80821 8.33159L10.8074 8.38769L11.042 0.0280498L9.04279 -0.0280498ZM0.758628 12.3448L10.801 0.651524L9.28377 -0.651524L-0.758628 11.0418L0.758628 12.3448ZM6.04126 10.6933H0V12.6933H6.04126V10.6933ZM6.80894 20.0279L7.04087 11.7212L5.04165 11.6654L4.80972 19.9721L6.80894 20.0279ZM14.9963 7.70998L5.0491 19.3503L6.56956 20.6497L16.5168 9.00929L14.9963 7.70998ZM9.80782 9.35964L15.7566 9.35964V7.35964L9.80782 7.35964V9.35964Z"
          fill={color}
          mask="url(#mask0)"
        />
      </G>
    </Svg>
  )
}
