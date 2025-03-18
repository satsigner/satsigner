import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { View } from 'react-native'

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
        router.navigate(`${segment}/${page.url}`)
      }
    },
    [router, segment]
  )

  return (
    <>
      <SSMainLayout style={{ paddingHorizontal: 2, gap: 60, paddingTop: 50 }}>
        <SSHStack>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <SSText
              uppercase
              size="3xl"
              weight="light"
              style={{
                color: Colors.gray[200],
                letterSpacing: 6,
                lineHeight: 26
              }}
            >
              {tab}
            </SSText>
          </View>
        </SSHStack>
        <SSVStack>
          {pages?.map((page, index) => (
            <SSHStack
              style={{ paddingHorizontal: '5%' }}
              key={`${index}-${tab}/${page.title}`}
            >
              <View style={{ flex: 1 }}>
                <SSButton
                  label={page.title}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: '#303030',
                    borderBottomWidth: 1,
                    borderBottomColor: '#222222',
                    borderRadius: 0
                  }}
                  textStyle={{
                    color: page.isSoon ? Colors.gray[450] : Colors.white
                  }}
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
    </>
  )
}
