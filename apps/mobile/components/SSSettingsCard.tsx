import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

import { SSIconChevronRight } from './icons'
import SSText from './SSText'

type SSSettingsCardsProps = {
  title: string
  description: string
  icon: React.ReactNode
  onPress(): void
}

function SSSettingsCards({
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
        <SSHStack style={{ alignItems: 'center', width: '94%' }}>
          {icon}
          <SSVStack gap="none" style={{ flexShrink: 1 }}>
            <SSText size="lg">{title}</SSText>
            <SSText color="muted">{description}</SSText>
          </SSVStack>
        </SSHStack>
        <SSHStack>
          <SSIconChevronRight height={11.6} width={6} />
        </SSHStack>
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

export default SSSettingsCards
