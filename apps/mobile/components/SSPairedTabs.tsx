import { Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { Colors, Sizes } from '@/styles'

type Tab<T extends string> = {
  key: T
  label: string
}

type SSPairedTabsProps<T extends string> = {
  activeTab: T
  primary: Tab<T>
  secondary: Tab<T>
  onChange: (tab: T) => void
}

function SSPairedTabs<T extends string>({
  activeTab,
  primary,
  secondary,
  onChange
}: SSPairedTabsProps<T>) {
  const tabs: Tab<T>[] = [primary, secondary]
  return (
    <SSHStack gap="md">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <View key={tab.key} style={styles.slot}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => onChange(tab.key)}
              style={({ pressed }) => [
                styles.tab,
                isActive ? styles.tabActive : styles.tabInactive,
                pressed && styles.tabPressed
              ]}
            >
              <SSText
                center
                uppercase
                weight="medium"
                style={{
                  color: isActive ? Colors.white : Colors.gray[50]
                }}
              >
                {tab.label}
              </SSText>
            </Pressable>
          </View>
        )
      })}
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

export default SSPairedTabs
