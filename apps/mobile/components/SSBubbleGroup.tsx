import {
  Circle,
  Group,
  Paint,
  Paragraph,
  Skia,
  type SkTypefaceFontProvider,
  TextAlign
} from '@shopify/react-native-skia'
import { useEffect, useMemo } from 'react'
import { useSharedValue, withDelay, withTiming } from 'react-native-reanimated'

import { Colors } from '@/styles'

type SSBubbleGroupProps = {
  title: string
  x: number
  y: number
  radius: number
  customFontManager: SkTypefaceFontProvider | null
  animationDelay?: number
}

function SSBubbleGroup({
  title,
  x,
  y,
  radius,
  customFontManager,
  animationDelay = 0
}: SSBubbleGroupProps) {
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.set(withDelay(animationDelay, withTiming(1, { duration: 250 })))
  }, [animationDelay, opacity])

  const titleParagraph = useMemo(() => {
    if (!customFontManager || !title) {
      return null
    }

    const fontSize = Math.min(14, Math.max(8, radius / 8))
    const para = Skia.ParagraphBuilder.Make(
      {
        maxLines: 1,
        textAlign: TextAlign.Center
      },
      customFontManager
    )
      .pushStyle({
        color: Skia.Color(Colors.gray[200]),
        fontFamilies: ['SF Pro Text'],
        fontSize,
        fontStyle: { weight: 500 }
      })
      .addText(title)
      .pop()
      .build()
    para.layout(radius * 1.6)
    return para
  }, [customFontManager, radius, title])

  if (!customFontManager) {
    return null
  }

  const titleWidth = radius * 1.6
  const titleHeight = titleParagraph?.getHeight() || 0

  return (
    <Group layer={<Paint opacity={opacity} />}>
      <Circle
        cx={x}
        cy={y}
        r={radius}
        color={Colors.gray[850]}
        style="fill"
        antiAlias
      />
      <Circle
        cx={x}
        cy={y}
        r={radius}
        color={Colors.gray[600]}
        style="stroke"
        strokeWidth={1}
        antiAlias
      />
      {titleParagraph ? (
        <Paragraph
          paragraph={titleParagraph}
          x={x - titleWidth / 2}
          y={y - radius + titleHeight * 0.25}
          width={titleWidth}
        />
      ) : null}
    </Group>
  )
}

export default SSBubbleGroup
