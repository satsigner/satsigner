import { Image } from 'expo-image'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

import SSText from './SSText'

type SSSettingsCardsProps = {
  title: string
  description: string
  icon: React.ReactNode
  onPress(): void
}

export default function SSSettingsCards({
  title,
  description,
  icon,
  onPress
}: SSSettingsCardsProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={styles.containerBase}
      onPress={() => onPress()}
    >
      <SSHStack justifyBetween>
        <SSHStack style={{ alignItems: 'center' }}>
          {icon}
          <SSVStack gap="none" style={{ maxWidth: '86%' }}>
            <SSText size="lg">{title}</SSText>
            <SSText color="muted">{description}</SSText>
          </SSVStack>
        </SSHStack>
        <Image
          style={{ width: 6, height: 11.6 }}
          source={require('@/assets/icons/chevron-right.svg')}
        />
      </SSHStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    borderTopWidth: 1,
    borderTopColor: Colors.gray[850],
    padding: 24
  }
})
