import { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { type Direction } from '@/types/logic/sort'

import { SSIconChevronDown, SSIconChevronUp } from './icons'
import SSText from './SSText'

type SSSortDirectionToggleProps = {
  label?: string
  showArrow?: boolean
  onDirectionChanged(direction: Direction): void
}

function SSSortDirectionToggle({
  label,
  showArrow = true,
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
      style={[styles.buttonBase, !label && { paddingVertical: 8 }]}
      activeOpacity={0.7}
      onPress={() => handleToggle()}
    >
      {label && (
        <SSText size="sm" color="muted">
          {label}
        </SSText>
      )}
      <View style={styles.arrowContainerBase}>
        {showArrow &&
          (direction === 'asc' ? (
            <SSIconChevronUp height={5} width={14} />
          ) : (
            <SSIconChevronDown height={5} width={14} />
          ))}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  arrowContainerBase: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 14
  }
})

export default SSSortDirectionToggle
