import { StyleSheet, View } from 'react-native'
import SSButton from '@/components/SSButton'
import { useRouter } from 'expo-router'
import SSMainLayout from '@/layouts/SSMainLayout'

export default function App() {
  const router = useRouter()

  return (
    <SSMainLayout>
      <SSButton
        label="Account List"
        onPress={() => router.push('/accountList/')}
      />
    </SSMainLayout>
  )
}
