import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function NetworksComparison() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Network comparison</SSText>,
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSText>Signet</SSText>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
