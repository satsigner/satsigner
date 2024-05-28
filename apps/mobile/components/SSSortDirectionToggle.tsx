import { Image } from 'expo-image'
import { useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSText from './SSText'

type Direction = 'asc' | 'desc'

type SSSortDirectionToggleProps = {
  label?: string
  showArrow?: boolean
  onDirectionChanged(direction: Direction): void
}

export default function SSSortDirectionToggle({
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
      style={styles.buttonBase}
      activeOpacity={0.7}
      onPress={() => handleToggle()}
    >
      {label && (
        <SSText size="sm" color="muted">
          {label}
        </SSText>
      )}
      {showArrow && direction === 'asc' ? (
        <Image
          style={{ width: 14, height: 5 }}
          source={require('@/assets/icons/chevron-up.svg')}
        />
      ) : (
        <Image
          style={{ width: 14, height: 5 }}
          source={require('@/assets/icons/chevron-down.svg')}
        />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  }
})
