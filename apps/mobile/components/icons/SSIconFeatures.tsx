import Svg, { Circle, G, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height'>

export default function SSIconFeature({ width, height }: IconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 24 24">
      <G id="hide-warning" opacity="0.5">
        <Path
          id="Path_1"
          fill-rule="evenodd"
          clip-rule="evenodd"
          data-name="Path 1"
          d="M20.2031 23.2876L13.1785 16.2629L16.1504 13.291L23.175 20.3157L20.2031 23.2876Z"
          fill="none"
          stroke="white"
        />
        <Path
          id="Path_1"
          fill-rule="evenodd"
          clip-rule="evenodd"
          data-name="Path 1"
          d="M14.455 17.3148L13.2913 16.1511L16.0381 13.4043L17.2018 14.568L14.455 17.3148Z"
          fill="none"
          stroke="white"
        />

        <Circle
          id="Ellipse_1"
          data-name="Ellipse 1"
          cx="9.06626"
          cy="8.82114"
          r="8.05161"
          stroke="white"
        />
      </G>
      <Circle
        id="Ellipse_2"
        data-name="Ellipse 2"
        cx="9.06667"
        cy="8.82253"
        r="5.69753"
        stroke="white"
      />
    </Svg>
  )
}
