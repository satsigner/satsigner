import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Image,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'

import SSText from '@/components/SSText'
import { slides } from '@/constants/slides'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { white } from '@/styles/colors'

const SPACING = 30

export default function UpComing() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const scrollX = useRef(new Animated.Value(0)).current
  const { width } = useWindowDimensions()
  const CARD_WIDTH = width * 0.6
  const SNAP_INTERVAL = CARD_WIDTH + SPACING

  const data = useMemo(() => {
    return slides.find((item) => item.page === params.title)?.items ?? []
  }, [params.title])

  useEffect(() => {
    if (!data.length) {
      router.navigate('/')
    }
  }, [data, router])

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
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
            renderItem={({ item, index }) => {
              const inputRange = [
                (index - 1) * SNAP_INTERVAL,
                index * SNAP_INTERVAL,
                (index + 1) * SNAP_INTERVAL
              ]

              const scale = scrollX.interpolate({
                extrapolate: 'clamp',
                inputRange,
                outputRange: [0.95, 1, 0.95]
              })

              const opacity = scrollX.interpolate({
                extrapolate: 'clamp',
                inputRange,
                outputRange: [0.2, 1, 0.2]
              })

              return (
                <Animated.View
                  style={[
                    styles.cardContainer,
                    { opacity, transform: [{ scale }], width: CARD_WIDTH }
                  ]}
                >
                  <SSVStack justifyBetween style={styles.cardContent}>
                    <SSVStack itemsCenter style={styles.textContainer}>
                      <SSText size="lg" style={styles.titleText}>
                        {item.title}
                      </SSText>
                      <SSText
                        size="lg"
                        color="muted"
                        center
                        style={styles.descriptionText}
                      >
                        {item.description}
                      </SSText>
                    </SSVStack>

                    <View style={[styles.card, { width: CARD_WIDTH }]}>
                      <Image source={item.image} style={styles.image} />
                    </View>
                  </SSVStack>
                </Animated.View>
              )
            }}
          />
        </View>

        <View style={styles.dotContainer}>
          {data.map((_, index) => {
            const dotColor = scrollX.interpolate({
              extrapolate: 'clamp',
              inputRange: [
                (index - 1) * SNAP_INTERVAL,
                index * SNAP_INTERVAL,
                (index + 1) * SNAP_INTERVAL
              ],
              outputRange: ['gray', 'white', 'gray']
            })

            return (
              <Animated.View
                key={index}
                style={[styles.dot, { backgroundColor: dotColor }]}
              />
            )
          })}
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
