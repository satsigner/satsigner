import Svg, { Mask, Path, type SvgProps } from 'react-native-svg'

type IconProps = Pick<SvgProps, 'width' | 'height' | 'color'>

export default function SSIconExplorer({
  width = 28,
  height = 16,
  color = '#909090'
}: IconProps) {
  return (
    <Svg width={width} height={height} fill="none" color={color}>
      <Mask id="a" fill="#fff">
        <Path
          fillRule="evenodd"
          d="M14 12.228a7.724 7.724 0 1 1 0-9.008 7.724 7.724 0 1 1 0 9.008Z"
          clipRule="evenodd"
        />
      </Mask>
      <Path
        fill="#909090"
        d="m14 12.228.812-.584-.812-1.13-.812 1.13.812.584Zm0-9.008-.812.584.812 1.13.812-1.13L14 3.22Zm-.812 8.424a6.714 6.714 0 0 1-5.464 2.804v2a8.714 8.714 0 0 0 7.088-3.636l-1.624-1.168Zm-5.464 2.804A6.724 6.724 0 0 1 1 7.724h-2a8.724 8.724 0 0 0 8.724 8.724v-2ZM1 7.724A6.724 6.724 0 0 1 7.724 1v-2A8.724 8.724 0 0 0-1 7.724h2ZM7.724 1a6.714 6.714 0 0 1 5.464 2.804l1.624-1.167A8.714 8.714 0 0 0 7.724-1v2Zm7.088 2.804A6.714 6.714 0 0 1 20.276 1v-2a8.714 8.714 0 0 0-7.088 3.637l1.624 1.167ZM20.276 1A6.724 6.724 0 0 1 27 7.724h2A8.724 8.724 0 0 0 20.276-1v2ZM27 7.724a6.724 6.724 0 0 1-6.724 6.724v2A8.724 8.724 0 0 0 29 7.724h-2Zm-6.724 6.724a6.714 6.714 0 0 1-5.464-2.804l-1.624 1.168a8.714 8.714 0 0 0 7.088 3.636v-2Z"
        mask="url(#a)"
      />
    </Svg>
  )
}
