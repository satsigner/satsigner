import { usePathname } from 'expo-router'
import { StyleSheet } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { type NavMenuGroup } from '@/types/navigation/navMenu'

import SSNavItem from './SSNavMenuItem'
import SSText from './SSText'

type SSNavMenuGroupProps = {
  group: NavMenuGroup
}

function SSNavMenuGroup({ group }: SSNavMenuGroupProps) {
  const currentPath = usePathname()

  return (
    <SSVStack style={styles.groupContainer}>
      <SSText uppercase size="sm" color="muted" style={styles.groupTitle}>
        {group.title}
      </SSText>
      {group.items.map((item, index) => (
        <SSNavItem
          key={`${index}-${group.title}/${item.title}`}
          group={group.title}
          item={item}
          focused={currentPath === item.url}
        />
      ))}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  groupContainer: {
    gap: 2,
    paddingHorizontal: 10
  },
  groupTitle: {
    marginLeft: 12,
    marginBottom: 8,
    letterSpacing: 6
  }
})

export default SSNavMenuGroup
