import Svg, { G, Path, Rect, type SvgProps } from 'react-native-svg'

import { getIconStrokeProps, type IconStrokeProps } from './iconStroke'

type IconProps = Pick<SvgProps, 'width' | 'height'>

const DEV_FRAME_RADIUS = 1.1

export default function SSIconDev({
  width,
  height,
  screenStrokeWidth
}: IconProps & IconStrokeProps) {
  const strokeProps = getIconStrokeProps(screenStrokeWidth)
  return (
    <Svg width={width} height={height} viewBox="0 0 16 16">
      <G id="dev" transform="translate(1049 -7662)">
        <Path
          id="ph--dev-to-logo-light"
          d="M19.013,61.518v1.513h.757a.454.454,0,1,1,0,.908h-.757v1.513h1.362a.454.454,0,1,1,0,.908H18.559a.454.454,0,0,1-.454-.454V61.064a.454.454,0,0,1,.454-.454h1.816a.454.454,0,1,1,0,.908Zm6.642-.331-1.362,4.843a.454.454,0,0,1-.875,0l-1.362-4.843a.454.454,0,0,1,.875-.245l.925,3.288.925-3.288a.454.454,0,1,1,.875.245M14.322,60.61h-.605a.454.454,0,0,0-.454.454v4.843a.454.454,0,0,0,.454.454h.605a2.27,2.27,0,0,0,2.27-2.27V62.88a2.27,2.27,0,0,0-2.27-2.27m1.362,3.481a1.362,1.362,0,0,1-1.362,1.362h-.151V61.518h.151a1.362,1.362,0,0,1,1.362,1.362Z"
          transform="translate(-1060.467 7606.515)"
          fill="#fff"
        />
      </G>
      <Rect
        x={0.5}
        y={0.5}
        width={15}
        height={15}
        rx={DEV_FRAME_RADIUS}
        fill="none"
        stroke="#828282"
        {...strokeProps}
      />
    </Svg>
  )
}
