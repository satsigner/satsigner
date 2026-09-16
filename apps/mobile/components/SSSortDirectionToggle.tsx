import { useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { type Direction } from '@/types/logic/sort'

import { SSIconChevronDown, SSIconChevronUp } from './icons'
import SSIconButton from './SSIconButton'
import SSText from './SSText'

const LABELED_ARROW_HEIGHT = 5
const LABELED_ARROW_WIDTH = 14
const UNLABELED_ARROW_HEIGHT = 8
const UNLABELED_ARROW_WIDTH = 18

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

  const arrow =
    direction === 'asc' ? (
      <SSIconChevronUp
        height={label ? LABELED_ARROW_HEIGHT : UNLABELED_ARROW_HEIGHT}
        width={label ? LABELED_ARROW_WIDTH : UNLABELED_ARROW_WIDTH}
      />
    ) : (
      <SSIconChevronDown
        height={label ? LABELED_ARROW_HEIGHT : UNLABELED_ARROW_HEIGHT}
        width={label ? LABELED_ARROW_WIDTH : UNLABELED_ARROW_WIDTH}
      />
    )

  if (!label) {
    return <SSIconButton onPress={handleToggle}>{arrow}</SSIconButton>
  }

  return (
    <TouchableOpacity
      style={[styles.buttonBase, !active && styles.muted]}
      activeOpacity={0.7}
      onPress={handleToggle}
    >
      <View style={styles.arrowContainerBase}>{arrow}</View>
      <SSText size="sm" color={active ? 'white' : 'muted'}>
        {label}
      </SSText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  arrowContainerBase: {
    alignItems: 'center',
    justifyContent: 'center',
    width: LABELED_ARROW_WIDTH
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
