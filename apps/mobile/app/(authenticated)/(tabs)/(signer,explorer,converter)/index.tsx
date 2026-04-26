import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { navMenuGroups } from '@/constants/navItems'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useArkStore } from '@/store/ark'
import { Colors } from '@/styles'
import { type NavMenuItem } from '@/types/navigation/navMenu'

export default function Home() {
  const { tab } = useLocalSearchParams()
  const router = useRouter()
  const hasArkAccounts = useArkStore((state) => state.accounts.length > 0)
  const allPages = navMenuGroups.find((group) => group.title === tab)?.items
  const pages = allPages?.filter(
    (page) => page.url !== '/signer/ark' || hasArkAccounts
  )

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
              <SSHStack key={`${index}-${tab}/${page.title}`}>
                <View style={styles.buttonContainer}>
                  <SSButton
                    label={page.title}
                    textStyle={[
                      styles.buttonText,
                      page.isSoon && styles.buttonTextSoon
                    ]}
                    onPress={() => handlePress(page)}
                    variant="elevated"
                    uppercase
                    verticalIndex={index}
                    totalButtonsVertical={pages.length}
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
  buttonContainer: {
    flex: 1
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
    paddingTop: 50
  }
})
