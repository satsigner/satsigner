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
        <SSText size="sm" style={styles.summary} numberOfLines={1}>
          {summary}
        </SSText>
        {actions.map((action) => (
          <View key={action.label} style={styles.actionGroup}>
            <View style={styles.divider} />
            <Pressable
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
                size="sm"
                numberOfLines={1}
                style={[
                  styles.actionLabel,
                  action.destructive && styles.destructiveLabel
                ]}
              >
                {action.label}
              </SSText>
            </Pressable>
          </View>
        ))}
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          hitSlop={8}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionDimmed
          ]}
        >
          <SSIconX width={12} height={12} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  actionDimmed: {
    opacity: 0.5
  },
  actionGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1
  },
  actionLabel: {
    flexShrink: 1
  },
  bar: {
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 12,
    borderWidth: 1,
    elevation: 12,
    flexDirection: 'row',
    maxWidth: '100%',
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  destructiveLabel: {
    color: Colors.error
  },
  divider: {
    alignSelf: 'center',
    backgroundColor: Colors.gray[800],
    height: 20,
    width: StyleSheet.hairlineWidth
  },
  summary: {
    flexShrink: 1,
    paddingHorizontal: 10
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
