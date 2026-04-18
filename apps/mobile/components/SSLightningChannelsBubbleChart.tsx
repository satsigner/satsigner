import { Pressable, StyleSheet, View } from 'react-native'
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg'

import SSText from '@/components/SSText'
import {
  LIGHTNING_BUBBLE_CHART_AMOUNT_ON_BUBBLE_FONT_PX,
  LIGHTNING_BUBBLE_CHART_BUBBLE_FILL,
  LIGHTNING_BUBBLE_CHART_HUB_FILL,
  LIGHTNING_BUBBLE_CHART_LOCAL_BUBBLE_FILL,
  LIGHTNING_BUBBLE_CHART_LABEL_MAX_WIDTH_PX,
  LIGHTNING_BUBBLE_CHART_PEER_LABEL_FONT_PX,
  LIGHTNING_BUBBLE_CHART_SPOKE_STROKE,
  LIGHTNING_BUBBLE_CHART_SPOKE_STROKE_WIDTH
} from '@/constants/lightningChannelsBubbleChart'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'
import {
  type LightningBubbleChannelRow,
  buildLightningChannelsBubbleLayout
} from '@/utils/lightningChannelsBubbleLayout'

const PRIVACY_MASK = '••••'

type SSLightningChannelsBubbleChartProps = {
  height: number
  onChannelPress: (chanId: string) => void
  privacyMode: boolean
  rows: LightningBubbleChannelRow[]
  width: number
}

function SSLightningChannelsBubbleChart({
  height,
  onChannelPress,
  privacyMode,
  rows,
  width
}: SSLightningChannelsBubbleChartProps) {
  const layout = buildLightningChannelsBubbleLayout(rows, width, height)

  if (!layout) {
    return null
  }

  const { hub, channels } = layout
  const fmt = (n: number) =>
    privacyMode ? PRIVACY_MASK : formatNumber(Math.round(n))

  return (
    <View
      style={[
        styles.root,
        { height: layout.canvasHeight, width: layout.canvasWidth }
      ]}
    >
      <Svg height={layout.canvasHeight} width={layout.canvasWidth}>
        {channels.map((ch) => (
          <G key={ch.chanId}>
            <Line
              stroke={LIGHTNING_BUBBLE_CHART_SPOKE_STROKE}
              strokeWidth={LIGHTNING_BUBBLE_CHART_SPOKE_STROKE_WIDTH}
              x1={ch.spoke.x1}
              x2={ch.spoke.x2}
              y1={ch.spoke.y1}
              y2={ch.spoke.y2}
            />
            <Circle
              cx={ch.local.cx}
              cy={ch.local.cy}
              fill={LIGHTNING_BUBBLE_CHART_LOCAL_BUBBLE_FILL}
              r={ch.local.r}
            />
            <Circle
              cx={ch.remote.cx}
              cy={ch.remote.cy}
              fill={LIGHTNING_BUBBLE_CHART_BUBBLE_FILL}
              r={ch.remote.r}
            />
            <SvgText
              fill={Colors.white}
              fontSize={LIGHTNING_BUBBLE_CHART_AMOUNT_ON_BUBBLE_FONT_PX}
              textAnchor="middle"
              x={ch.local.cx}
              y={ch.local.cy + 3}
            >
              {fmt(ch.localSats)}
            </SvgText>
            <SvgText
              fill={Colors.white}
              fontSize={LIGHTNING_BUBBLE_CHART_AMOUNT_ON_BUBBLE_FONT_PX}
              textAnchor="middle"
              x={ch.remote.cx}
              y={ch.remote.cy + 3}
            >
              {fmt(ch.remoteSats)}
            </SvgText>
          </G>
        ))}
        <Circle
          cx={hub.cx}
          cy={hub.cy}
          fill={LIGHTNING_BUBBLE_CHART_HUB_FILL}
          r={hub.radius}
        />
      </Svg>

      <View
        pointerEvents="none"
        style={[
          styles.hubTextBlock,
          {
            height: hub.radius * 2,
            left: hub.cx - hub.radius,
            top: hub.cy - hub.radius,
            width: hub.radius * 2,
            zIndex: 2
          }
        ]}
      >
        <SSText center color="black" size="xxs" weight="medium">
          {t('lightning.node.bubbleHubInbound')}
        </SSText>
        <SSText
          center
          color="black"
          size="sm"
          weight="light"
          style={styles.hubNumber}
        >
          {fmt(hub.totalInboundSats)}
        </SSText>
        <SSText
          center
          color="black"
          size="sm"
          weight="light"
          style={styles.hubNumber}
        >
          {fmt(hub.totalOutboundSats)}
        </SSText>
        <SSText center color="black" size="xxs" weight="medium">
          {t('lightning.node.bubbleHubOutbound')}
        </SSText>
      </View>

      {channels.map((ch) => (
        <View
          key={`label-${ch.chanId}`}
          pointerEvents="none"
          style={[
            styles.peerLabelWrap,
            {
              left: ch.label.x - LIGHTNING_BUBBLE_CHART_LABEL_MAX_WIDTH_PX / 2,
              top: ch.label.y - LIGHTNING_BUBBLE_CHART_PEER_LABEL_FONT_PX,
              width: LIGHTNING_BUBBLE_CHART_LABEL_MAX_WIDTH_PX,
              zIndex: 2
            }
          ]}
        >
          <SSText
            center
            color="white"
            numberOfLines={1}
            size="xxs"
            style={styles.peerLabelText}
            weight="medium"
          >
            {ch.peerLabel}
          </SSText>
        </View>
      ))}

      {channels.map((ch) => (
        <Pressable
          key={`hit-${ch.chanId}`}
          accessibilityLabel={t('lightning.node.bubbleChannelA11y', {
            chanId: ch.chanId,
            peer: ch.peerLabel
          })}
          accessibilityRole="button"
          onPress={() => onChannelPress(ch.chanId)}
          style={[
            styles.hit,
            {
              height: ch.hitSlop.height,
              left: ch.hitSlop.left,
              top: ch.hitSlop.top,
              width: ch.hitSlop.width,
              zIndex: 3
            }
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  hit: {
    position: 'absolute'
  },
  hubNumber: {
    lineHeight: 18,
    marginVertical: 2
  },
  hubTextBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute'
  },
  peerLabelText: {
    fontSize: LIGHTNING_BUBBLE_CHART_PEER_LABEL_FONT_PX,
    lineHeight: LIGHTNING_BUBBLE_CHART_PEER_LABEL_FONT_PX + 2
  },
  peerLabelWrap: {
    position: 'absolute'
  },
  root: {
    alignSelf: 'center',
    position: 'relative'
  }
})

export default SSLightningChannelsBubbleChart
