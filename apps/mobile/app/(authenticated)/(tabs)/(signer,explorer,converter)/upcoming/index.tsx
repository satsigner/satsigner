import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import { Animated, Dimensions, Image, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import { slides } from '@/constants/slides'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { white } from '@/styles/colors'

const { width } = Dimensions.get('window')
const CARD_WIDTH = width * 0.6
const SPACING = 30
const SNAP_INTERVAL = CARD_WIDTH + SPACING

export default function UpComing() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const scrollX = useRef(new Animated.Value(0)).current

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
            contentContainerStyle={styles.flatListContent}
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
                inputRange,
                outputRange: [0.95, 1, 0.95],
                extrapolate: 'clamp'
              })

              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.2, 1, 0.2],
                extrapolate: 'clamp'
              })

              return (
                <Animated.View
                  style={[
                    styles.cardContainer,
                    { transform: [{ scale }], opacity }
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

                    <View style={styles.card}>
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
              inputRange: [
                (index - 1) * SNAP_INTERVAL,
                index * SNAP_INTERVAL,
                (index + 1) * SNAP_INTERVAL
              ],
              outputRange: ['gray', 'white', 'gray'],
              extrapolate: 'clamp'
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
  headerTitle: {
    letterSpacing: 1
  },
  mainContainer: {
    flex: 1,
    paddingTop: 40,
    paddingBottom: 15,
    gap: 60
  },
  flexContainer: {
    flex: 1
  },
  flatListContent: {
    paddingHorizontal: (width - CARD_WIDTH - SPACING) / 2
  },
  cardContainer: {
    flex: 1,
    width: CARD_WIDTH,
    marginHorizontal: SPACING / 2
  },
  cardContent: {
    flex: 1,
    gap: 50
  },
  textContainer: {
    width: '100%',
    paddingHorizontal: 10
  },
  titleText: {
    lineHeight: 20
  },
  descriptionText: {
    lineHeight: 16
  },
  card: {
    flex: 1,
    width: CARD_WIDTH,
    height: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    padding: 2
  },
  image: {
    height: '100%',
    aspectRatio: '6 / 13',
    resizeMode: 'contain',
    borderColor: white,
    borderWidth: 1,
    borderRadius: 16
  },
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center'
  },
  dot: {
    height: 4,
    width: 4,
    borderRadius: 2,
    marginHorizontal: 10
  }
})
