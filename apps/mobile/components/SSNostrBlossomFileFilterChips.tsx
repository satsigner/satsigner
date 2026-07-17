import { ScrollView, Pressable, StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import { Colors } from '@/styles'
import { type BlossomFileTypeFilter } from '@/types/models/Blossom'
import { getBlossomFileTypeFilterLabel } from '@/utils/blossomFiles'

type SSNostrBlossomFileFilterChipsProps = {
  activeFilter: BlossomFileTypeFilter
  availableFilters: BlossomFileTypeFilter[]
  onFilterChange: (filter: BlossomFileTypeFilter) => void
}

type SSNostrBlossomFileFilterChipProps = {
  active: boolean
  filter: BlossomFileTypeFilter
  onSelect: (filter: BlossomFileTypeFilter) => void
}

function SSNostrBlossomFileFilterChip({
  active,
  filter,
  onSelect
}: SSNostrBlossomFileFilterChipProps) {
  function handlePress() {
    onSelect(filter)
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <SSText color={active ? 'white' : 'muted'} size="xs" uppercase>
        {getBlossomFileTypeFilterLabel(filter)}
      </SSText>
    </Pressable>
  )
}

function SSNostrBlossomFileFilterChips({
  activeFilter,
  availableFilters,
  onFilterChange
}: SSNostrBlossomFileFilterChipsProps) {
  if (availableFilters.length <= 1) {
    return null
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
      contentContainerStyle={styles.chips}
    >
      {availableFilters.map((filter) => (
        <SSNostrBlossomFileFilterChip
          active={activeFilter === filter}
          filter={filter}
          key={filter}
          onSelect={onFilterChange}
        />
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderColor: Colors.gray[700],
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  chipActive: {
    backgroundColor: Colors.gray[700],
    borderColor: Colors.gray[700]
  },
  chips: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8
  },
  chipsScroll: {
    flexGrow: 0,
    flexShrink: 0
  }
})

export default SSNostrBlossomFileFilterChips
