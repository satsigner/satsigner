import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming
} from 'react-native-reanimated'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { navMenuGroups } from '@/constants/navItems'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type NavMenuItem } from '@/types/navigation/navMenu'

const STAGGER_DELAY = 60
const ITEM_DURATION = 150
const STAGGER_SLIDE_UP = 24
const FADE_OUT_DURATION = 120

const BUTTON_ICON_SIZE = 16
const BUTTON_ICON_OPACITY = 0.4
const BUTTON_ICON_OPACITY_SOON = 0.18
const BUTTON_ICON_GAP = 10
const BUTTON_ICON_MARGIN_OFFSET = -8

type StaggerItemProps = {
  children: React.ReactNode
  index: number
  progress: SharedValue<number>
  totalItems: number
}

function StaggerItem({
  children,
  index,
  progress,
  totalItems
}: StaggerItemProps) {
  const totalDuration = (totalItems - 1) * STAGGER_DELAY + ITEM_DURATION
  const itemStart = (index * STAGGER_DELAY) / totalDuration
  const itemEnd = (index * STAGGER_DELAY + ITEM_DURATION) / totalDuration

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [itemStart, itemEnd],
      [0, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [itemStart, itemEnd],
          [STAGGER_SLIDE_UP, 0],
          Extrapolation.CLAMP
        )
      }
    ]
  }))

  return <Animated.View style={animatedStyle}>{children}</Animated.View>
}

export default function Home() {
  const { tab } = useLocalSearchParams()
  const router = useRouter()
  const pages = navMenuGroups.find((group) => group.title === tab)?.items
  const totalItems = 1 + (pages?.length ?? 0)
  const totalDuration = (totalItems - 1) * STAGGER_DELAY + ITEM_DURATION

  const containerOpacity = useSharedValue(1)
  const progress = useSharedValue(0)

  useFocusEffect(
    useCallback(() => {
      containerOpacity.value = 1
      progress.value = 0
      progress.value = withDelay(
        FADE_OUT_DURATION,
        withTiming(1, { duration: totalDuration })
      )
      return () => {
        containerOpacity.value = withTiming(0, { duration: FADE_OUT_DURATION })
      }
    }, [totalDuration])
  )

  const containerStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: containerOpacity.value
  }))

  const handlePress = useCallback(
    (page: NavMenuItem) => {
      if (page.isSoon) {
        router.navigate({
          params: { title: page.title },
          pathname: '/upcoming'
        })
      } else if (page.url) {
        router.navigate(page.url)
      }
    },
    [router]
  )

  return (
    <>
      <Animated.View style={containerStyle}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSMainLayout style={styles.mainLayout}>
            <StaggerItem index={0} progress={progress} totalItems={totalItems}>
              <SSHStack>
                <View style={styles.headerContainer}>
                  <SSText
                    uppercase
                    size="2xl"
                    weight="light"
                    style={styles.headerText}
                  >
                    {tab}
                  </SSText>
                </View>
              </SSHStack>
            </StaggerItem>
            <SSVStack>
              {pages?.map((page, index) => (
                <StaggerItem
                  key={`${index}-${tab}/${page.title}`}
                  index={index + 1}
                  progress={progress}
                  totalItems={totalItems}
                >
                  <SSHStack>
                    <View style={styles.buttonContainer}>
                      <SSButton
                        icon={
                          <View style={styles.buttonContent}>
                            <View
                              style={[
                                styles.buttonIcon,
                                page.isSoon && styles.buttonIconSoon
                              ]}
                            >
                              <page.icon
                                width={BUTTON_ICON_SIZE}
                                height={BUTTON_ICON_SIZE}
                              />
                            </View>
                            <SSText
                              uppercase
                              style={[
                                styles.buttonText,
                                page.isSoon && styles.buttonTextSoon
                              ]}
                            >
                              {page.title}
                            </SSText>
                          </View>
                        }
                        onPress={() => handlePress(page)}
                        variant="elevated"
                        verticalIndex={index}
                        totalButtonsVertical={pages.length}
                      />
                    </View>
                  </SSHStack>
                </StaggerItem>
              ))}
            </SSVStack>
          </SSMainLayout>
        </ScrollView>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  buttonContainer: {
    flex: 1
  },
  buttonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: BUTTON_ICON_GAP,
    marginLeft: BUTTON_ICON_MARGIN_OFFSET
  },
  buttonIcon: {
    opacity: BUTTON_ICON_OPACITY
  },
  buttonIconSoon: {
    opacity: BUTTON_ICON_OPACITY_SOON
  },
  buttonText: {
    color: Colors.white
  },
  buttonTextSoon: {
    color: Colors.gray[450]
  },
  headerContainer: {
    alignItems: 'center',
    flex: 1
  },
  headerText: {
    color: Colors.gray[500],
    letterSpacing: 6,
    lineHeight: 26,
    textShadowColor: 'rgba(255,255,255,0.12)',
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 10
  },
  mainLayout: {
    flexGrow: 1,
    gap: 60,
    marginBottom: 50,
    paddingTop: 50
  }
})
