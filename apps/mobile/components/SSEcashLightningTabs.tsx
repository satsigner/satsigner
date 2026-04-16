import { Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { Colors, Sizes } from '@/styles'

type SSEcashLightningTabsProps = {
  activeTab: 'ecash' | 'lightning'
  ecashLabel: string
  lightningLabel: string
  onChange: (tab: 'ecash' | 'lightning') => void
}

function SSEcashLightningTabs({
  activeTab,
  ecashLabel,
  lightningLabel,
  onChange
}: SSEcashLightningTabsProps) {
  return (
    <SSHStack gap="md">
      <View style={styles.slot}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'ecash' }}
          onPress={() => onChange('ecash')}
          style={({ pressed }) => [
            styles.tab,
            activeTab === 'ecash' ? styles.tabActive : styles.tabInactive,
            pressed && styles.tabPressed
          ]}
        >
          <SSText
            center
            uppercase
            weight="medium"
            style={{
              color: activeTab === 'ecash' ? Colors.white : Colors.gray[50]
            }}
          >
            {ecashLabel}
          </SSText>
        </Pressable>
      </View>
      <View style={styles.slot}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'lightning' }}
          onPress={() => onChange('lightning')}
          style={({ pressed }) => [
            styles.tab,
            activeTab === 'lightning' ? styles.tabActive : styles.tabInactive,
            pressed && styles.tabPressed
          ]}
        >
          <SSText
            center
            uppercase
            weight="medium"
            style={{
              color:
                activeTab === 'lightning' ? Colors.white : Colors.gray[50]
            }}
          >
            {lightningLabel}
          </SSText>
        </Pressable>
      </View>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    minWidth: 0
  },
  tab: {
    alignItems: 'center',
    borderRadius: Sizes.button.borderRadius,
    height: Sizes.button.height,
    justifyContent: 'center',
    paddingHorizontal: 8,
    width: '100%'
  },
  tabActive: {
    backgroundColor: Colors.transparent,
    borderColor: Colors.gray[75],
    borderWidth: 1
  },
  tabInactive: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[900],
    borderWidth: 1
  },
  tabPressed: {
    opacity: 0.88
  }
})

export default SSEcashLightningTabs
