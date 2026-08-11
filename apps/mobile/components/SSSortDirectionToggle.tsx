import { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { type Direction } from '@/types/logic/sort'

import { SSIconChevronDown, SSIconChevronUp } from './icons'
import SSText from './SSText'

type SSSortDirectionToggleProps = {
  label?: string
  /** When false, label and arrow are muted (inactive sort field). */
  active?: boolean
  onDirectionChanged(direction: Direction): void
}

function SSSortDirectionToggle({
  label,
  active = true,
  onDirectionChanged
}: SSSortDirectionToggleProps) {
  const [direction, setDirection] = useState<Direction>('desc')

  function handleToggle() {
    const newDirection = direction === 'asc' ? 'desc' : 'asc'

    setDirection(newDirection)
    onDirectionChanged(newDirection)
  }

  return (
    <TouchableOpacity
      style={[
        styles.buttonBase,
        !label && { paddingVertical: 8 },
        !active && styles.muted
      ]}
      activeOpacity={0.7}
      onPress={handleToggle}
    >
      <View style={styles.arrowContainerBase}>
        {direction === 'asc' ? (
          <SSIconChevronUp height={5} width={14} />
        ) : (
          <SSIconChevronDown height={5} width={14} />
        )}
      </View>
      {label ? (
        <SSText size="sm" color={active ? 'white' : 'muted'}>
          {label}
        </SSText>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  arrowContainerBase: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 14
  },
  buttonBase: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    opacity: 1
  },
  muted: {
    opacity: 0.4
  }
})

export default SSSortDirectionToggle
