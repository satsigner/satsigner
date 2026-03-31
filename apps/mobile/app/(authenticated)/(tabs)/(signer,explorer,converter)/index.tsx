import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { navMenuGroups } from '@/constants/navItems'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type NavMenuItem } from '@/types/navigation/navMenu'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Home() {
  const { tab, segment } = useLocalSearchParams()
  const router = useRouter()
  const pages = navMenuGroups.filter((group) => group.title === tab)[0]?.items

  const handlePress = useCallback(
    (page: NavMenuItem) => {
      if (page.isSoon) {
        router.navigate({
          params: { title: page.title },
          pathname: `${segment}/upcoming/`
        })
      } else {
        router.navigate(`${segment}${page.url}`)
      }
    },
    [router, segment]
  )

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSMainLayout style={styles.mainLayout}>
          <SSHStack>
            <View style={styles.headerContainer}>
              <SSText
                uppercase
                size="3xl"
                weight="light"
                style={styles.headerText}
              >
                {tab}
              </SSText>
            </View>
          </SSHStack>
          <SSVStack>
            {pages?.map((page, index) => (
              <SSHStack
                style={styles.buttonRow}
                key={`${index}-${tab}/${page.title}`}
              >
                <View style={styles.buttonContainer}>
                  <SSButton
                    label={page.title}
                    style={styles.button}
                    textStyle={[
                      styles.buttonText,
                      page.isSoon && styles.buttonTextSoon
                    ]}
                    onPress={() => handlePress(page)}
                    variant="gradient"
                    gradientType="special"
                    uppercase
                  />
                </View>
              </SSHStack>
            ))}
          </SSVStack>
        </SSMainLayout>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    borderBottomColor: '#222222',
    borderBottomWidth: 1,
    borderRadius: 0,
    borderTopColor: '#303030',
    borderTopWidth: 1
  },
  buttonContainer: {
    flex: 1
  },
  buttonRow: {
    paddingHorizontal: '5%'
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
    color: Colors.gray[200],
    letterSpacing: 6,
    lineHeight: 26
  },
  mainLayout: {
    flexGrow: 1,
    gap: 60,
    marginBottom: 50,
    paddingHorizontal: 2,
    paddingTop: 50
  }
})
