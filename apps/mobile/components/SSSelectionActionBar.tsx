import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import { SSIconX } from '@/components/icons'
import SSText from '@/components/SSText'
import { Colors } from '@/styles'

export type SSSelectionAction = {
  label: string
  icon?: ReactNode
  onPress: () => void
  destructive?: boolean
  disabled?: boolean
}

type SSSelectionActionBarProps = {
  visible: boolean
  summary: string
  actions: SSSelectionAction[]
  onClear: () => void
}

function SSSelectionActionBar({
  visible,
  summary,
  actions,
  onClear
}: SSSelectionActionBarProps) {
  if (!visible) {
    return null
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.header}>
          <SSText size="sm" style={styles.summary}>
            {summary}
          </SSText>
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.actionDimmed}
          >
            <SSIconX width={12} height={12} />
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.actionRow}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityLabel={action.label}
              accessibilityRole="button"
              disabled={action.disabled}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.action,
                (pressed || action.disabled) && styles.actionDimmed
              ]}
            >
              {action.icon}
              <SSText
                size="xs"
                center
                style={action.destructive && styles.destructiveLabel}
              >
                {action.label}
              </SSText>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 10
  },
  actionDimmed: {
    opacity: 0.5
  },
  actionRow: {
    flexDirection: 'row'
  },
  bar: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    elevation: 12,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  destructiveLabel: {
    color: Colors.error
  },
  divider: {
    backgroundColor: Colors.gray[800],
    height: StyleSheet.hairlineWidth
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  summary: {
    flexShrink: 1
  },
  wrapper: {
    alignItems: 'center',
    bottom: 24,
    left: 12,
    position: 'absolute',
    right: 12
  }
})

export default SSSelectionActionBar
