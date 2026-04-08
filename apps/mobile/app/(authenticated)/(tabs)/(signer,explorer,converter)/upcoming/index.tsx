import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated'

import SSText from '@/components/SSText'
import { slides } from '@/constants/slides'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { white } from '@/styles/colors'

const SPACING = 30

function CarouselCard({
  item,
  index,
  scrollX,
  cardWidth,
  snapInterval
}: {
  item: { title: string; description: string; image: number }
  index: number
  scrollX: SharedValue<number>
  cardWidth: number
  snapInterval: number
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * snapInterval,
      index * snapInterval,
      (index + 1) * snapInterval
    ]
    return {
      opacity: interpolate(scrollX.value, inputRange, [0.2, 1, 0.2], 'clamp'),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            inputRange,
            [0.95, 1, 0.95],
            'clamp'
          )
        }
      ]
    }
  })

  return (
    <Animated.View
      style={[styles.cardContainer, { width: cardWidth }, animatedStyle]}
    >
      <SSVStack justifyBetween style={styles.cardContent}>
        <SSVStack itemsCenter style={styles.textContainer}>
          <SSText size="lg" style={styles.titleText}>
            {item.title}
          </SSText>
          <SSText size="lg" color="muted" center style={styles.descriptionText}>
            {item.description}
          </SSText>
        </SSVStack>

        <View style={[styles.card, { width: cardWidth }]}>
          <Image source={item.image} style={styles.image} />
        </View>
      </SSVStack>
    </Animated.View>
  )
}

function DotIndicator({
  index,
  scrollX,
  snapInterval
}: {
  index: number
  scrollX: SharedValue<number>
  snapInterval: number
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollX.value,
      [
        (index - 1) * snapInterval,
        index * snapInterval,
        (index + 1) * snapInterval
      ],
      ['gray', 'white', 'gray']
    )
  }))

  return <Animated.View style={[styles.dot, animatedStyle]} />
}

export default function UpComing() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const scrollX = useSharedValue(0)
  const { width } = useWindowDimensions()
  const CARD_WIDTH = width * 0.6
  const SNAP_INTERVAL = CARD_WIDTH + SPACING

  const data = useMemo(
    () => slides.find((item) => item.page === params.title)?.items ?? [],
    [params.title]
  )

  useEffect(() => {
    if (!data.length) {
      router.navigate('/')
    }
  }, [data, router])

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x
    }
  })

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={styles.headerTitle}>
              {t('upcoming.name')}
            </SSText>
          )
        }}
      />

      <SSVStack style={styles.mainContainer}>
        <View style={styles.flexContainer}>
          <Animated.FlatList
            data={data}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingHorizontal: (width - CARD_WIDTH - SPACING) / 2
            }}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            renderItem={({ item, index }) => (
              <CarouselCard
                item={item}
                index={index}
                scrollX={scrollX}
                cardWidth={CARD_WIDTH}
                snapInterval={SNAP_INTERVAL}
              />
            )}
          />
        </View>

        <View style={styles.dotContainer}>
          {data.map((_, index) => (
            <DotIndicator
              key={index}
              index={index}
              scrollX={scrollX}
              snapInterval={SNAP_INTERVAL}
            />
          ))}
        </View>
      </SSVStack>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    padding: 2
  },
  cardContainer: {
    flex: 1,
    marginHorizontal: SPACING / 2
  },
  cardContent: {
    flex: 1,
    gap: 50
  },
  descriptionText: {
    lineHeight: 16
  },
  dot: {
    borderRadius: 2,
    height: 4,
    marginHorizontal: 10,
    width: 4
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  flexContainer: {
    flex: 1
  },
  headerTitle: {
    letterSpacing: 1
  },
  image: {
    aspectRatio: '6 / 13',
    borderColor: white,
    borderRadius: 16,
    borderWidth: 1,
    height: '100%',
    resizeMode: 'contain'
  },
  mainContainer: {
    flex: 1,
    gap: 60,
    paddingBottom: 15,
    paddingTop: 40
  },
  textContainer: {
    paddingHorizontal: 10,
    width: '100%'
  },
  titleText: {
    lineHeight: 20
  }
})
