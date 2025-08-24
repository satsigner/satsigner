import { useMemo, useState } from 'react'
import { type LayoutChangeEvent, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg'

import SSText from '@/components/SSText'
import { t } from '@/locales'

const RADIUS_INDICATOR = 8
const RADIUS_INNER_RECT = 13
const RADIUS_OUTER_RECT = 16

type SSMultisigCountSelectorProps = {
  maxCount: number
  requiredNumber: number
  totalNumber: number
  viewOnly: boolean
  onChangeTotalNumber?: (value: number) => void
  onChangeRequiredNumber?: (value: number) => void
}

function SSMultisigCountSelector({
  maxCount,
  requiredNumber,
  totalNumber,
  viewOnly,
  onChangeRequiredNumber = () => {},
  onChangeTotalNumber = () => {}
}: SSMultisigCountSelectorProps) {
  const [containerSize, setContainersize] = useState({ width: 0, height: 0 })
  const [activeTotalNumber, setActiveTotalNumber] = useState<boolean>(false)
  const [activeRequiredNumber, setActiveRequiredNumber] =
    useState<boolean>(false)

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setContainersize({ width, height })
  }

  const sizeBetweenPoints = useMemo(() => {
    return (containerSize.width - RADIUS_OUTER_RECT * 2) / (maxCount - 1)
  }, [containerSize.width, maxCount])

  const centerPoints = useMemo(() => {
    return Array.from({ length: maxCount }, (_, i) => i).map(
      (i) => sizeBetweenPoints * i + RADIUS_OUTER_RECT
    )
  }, [maxCount, sizeBetweenPoints])

  const panGesture = viewOnly
    ? Gesture.Pan()
    : Gesture.Pan()
        .activateAfterLongPress(30)
        .onStart((event) => {
          const x = event.x
          const index = centerPoints.findIndex((point) => {
            return (
              x >= point - RADIUS_INDICATOR && x <= point + RADIUS_INDICATOR
            )
          })
          if (index + 1 === requiredNumber) {
            setActiveRequiredNumber(true)
          } else if (index + 1 === totalNumber) {
            setActiveTotalNumber(true)
          }
        })
        .onUpdate((event) => {
          const x = event.x
          const index = centerPoints.findIndex((point) => {
            return (
              x >= point - RADIUS_INDICATOR && x <= point + RADIUS_INDICATOR
            )
          })
          if (index === -1) {
            return
          }
          if (activeTotalNumber) {
            if (index + 1 < requiredNumber) {
              onChangeRequiredNumber(index + 1)
            }
            onChangeTotalNumber(index + 1)
          }
          if (activeRequiredNumber) {
            if (index + 1 > totalNumber) {
              onChangeTotalNumber(index + 1)
            }
            onChangeRequiredNumber(index + 1)
          }
        })
        .onEnd(() => {
          setActiveRequiredNumber(false)
          setActiveTotalNumber(false)
        })
        .runOnJS(true)

  return (
    <View
      style={{
        flexDirection: 'column'
      }}
    >
      {!viewOnly && (
        <>
          <SSText style={{ alignSelf: 'center' }}>
            {t('account.signatureRequired')}
          </SSText>
          <SSText
            style={{
              alignSelf: 'center',
              fontSize: 55,
              textTransform: 'lowercase'
            }}
          >
            {requiredNumber} {t('common.of')} {totalNumber}
          </SSText>
        </>
      )}
      <View>
        <GestureDetector gesture={panGesture}>
          <View
            style={{
              backgroundColor: 'transparent',
              height: 80
            }}
            onLayout={handleLayout}
          >
            <Svg
              width={containerSize.width}
              height={100}
              pointerEvents="box-none"
              style={{ height: 100 }}
            >
              <G>
                {Array.from({ length: maxCount }, (_, i) => i).map((count) => (
                  <SvgText
                    key={count}
                    x={centerPoints[count]}
                    y={10}
                    fill={
                      count + 1 > totalNumber
                        ? '#FFFFFF17'
                        : count + 1 === totalNumber
                          ? 'white'
                          : count + 1 === requiredNumber
                            ? 'white'
                            : '#FFFFFF33'
                    }
                    fontSize={12}
                    textAnchor="middle"
                  >
                    {count + 1}
                  </SvgText>
                ))}
              </G>
              <G>
                <Circle
                  cx={RADIUS_OUTER_RECT}
                  cy={35}
                  r={RADIUS_OUTER_RECT}
                  fill="black"
                />
                <Rect
                  x={RADIUS_OUTER_RECT}
                  y={35 - RADIUS_OUTER_RECT}
                  width={containerSize.width - RADIUS_OUTER_RECT * 2}
                  height={RADIUS_OUTER_RECT * 2}
                  fill="black"
                />
                <Circle
                  cx={containerSize.width - RADIUS_OUTER_RECT}
                  cy={35}
                  r={RADIUS_OUTER_RECT}
                  fill="black"
                />
              </G>
              <G>
                <Circle
                  cx={RADIUS_OUTER_RECT}
                  cy={35}
                  r={RADIUS_INNER_RECT}
                  fill="#4A4A4A"
                />
                <Rect
                  x={RADIUS_OUTER_RECT}
                  y={35 - RADIUS_INNER_RECT}
                  width={sizeBetweenPoints * (totalNumber - 1)}
                  height={RADIUS_INNER_RECT * 2}
                  fill="#4A4A4A"
                />
                <Circle
                  cx={sizeBetweenPoints * (totalNumber - 1) + RADIUS_OUTER_RECT}
                  cy={35}
                  r={RADIUS_INNER_RECT}
                  fill="#4A4A4A"
                />
              </G>
              <G>
                <Circle
                  cx={RADIUS_OUTER_RECT}
                  cy={35}
                  r={RADIUS_INNER_RECT}
                  fill="#BFBFBF"
                />
                <Rect
                  x={RADIUS_OUTER_RECT}
                  y={35 - RADIUS_INNER_RECT}
                  width={sizeBetweenPoints * (requiredNumber - 1)}
                  height={RADIUS_INNER_RECT * 2}
                  fill="#BFBFBF"
                />
                <Circle
                  cx={
                    sizeBetweenPoints * (requiredNumber - 1) + RADIUS_OUTER_RECT
                  }
                  cy={35}
                  r={RADIUS_INNER_RECT}
                  fill="#BFBFBF"
                />
              </G>
              <G>
                {Array.from({ length: maxCount }, (_, i) => i).map((count) => (
                  <Circle
                    key={count}
                    cx={centerPoints[count]}
                    cy={35}
                    r={RADIUS_INDICATOR}
                    strokeWidth={1}
                    stroke={count + 1 <= totalNumber ? 'white' : 'transparent'}
                    fill={
                      count + 1 > totalNumber
                        ? '#242424'
                        : count + 1 === totalNumber
                          ? 'white'
                          : count + 1 === requiredNumber
                            ? 'white'
                            : 'transparent'
                    }
                  />
                ))}
              </G>
            </Svg>
          </View>
        </GestureDetector>
      </View>
    </View>
  )
}

export default SSMultisigCountSelector
