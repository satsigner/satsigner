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

export default function Home() {
  const { tab, segment } = useLocalSearchParams()
  const router = useRouter()
  const pages = navMenuGroups.filter((group) => group.title === tab)[0]?.items

  const handlePress = useCallback(
    (page: NavMenuItem) => {
      if (page.isSoon) {
        router.navigate({
          pathname: `${segment}/upcoming/`,
          params: { title: page.title }
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
  mainLayout: {
    flexGrow: 1,
    paddingHorizontal: 2,
    gap: 60,
    paddingTop: 50,
    marginBottom: 50
  },
  headerContainer: {
    flex: 1,
    alignItems: 'center'
  },
  headerText: {
    color: Colors.gray[200],
    letterSpacing: 6,
    lineHeight: 26
  },
  buttonRow: {
    paddingHorizontal: '5%'
  },
  buttonContainer: {
    flex: 1
  },
  button: {
    borderTopWidth: 1,
    borderTopColor: '#303030',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    borderRadius: 0
  },
  buttonText: {
    color: Colors.white
  },
  buttonTextSoon: {
    color: Colors.gray[450]
  }
})
