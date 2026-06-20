import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'

import SSIconChevronDown from '@/components/icons/SSIconChevronDown'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import {
  NOSTR_KIND_FILTER_HIT_SLOP,
  NOSTR_KIND_FILTER_TRIGGER_MAX_WIDTH
} from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type TextFontSize, type TextFontWeight } from '@/styles/sizes'
import { type NostrNoteKindFilterOption } from '@/types/models/Nostr'

const DROPDOWN_LABEL_MAX_CHARS = 36

function trimDropdownLabel(text: string): string {
  if (text.length <= DROPDOWN_LABEL_MAX_CHARS) {
    return text
  }
  return `${text.slice(0, DROPDOWN_LABEL_MAX_CHARS - 1)}…`
}

function splitKindFilterLabel(label: string): { main: string; suffix: string } {
  const open = label.lastIndexOf(' (')
  if (open === -1) {
    return { main: label, suffix: '' }
  }
  return { main: label.slice(0, open), suffix: label.slice(open) }
}

function trimKindFilterParts(
  main: string,
  suffix: string
): { main: string; suffix: string } {
  const full = main + suffix
  if (full.length <= DROPDOWN_LABEL_MAX_CHARS) {
    return { main, suffix }
  }
  const reserve = suffix.length + 1
  const budget = Math.max(8, DROPDOWN_LABEL_MAX_CHARS - reserve)
  return {
    main: `${main.slice(0, budget)}…`,
    suffix
  }
}

type SSNostrKindFilterLabelProps = {
  inline?: boolean
  label: string
  size?: TextFontSize
  weight?: TextFontWeight
}

function SSNostrKindFilterLabel({
  inline = false,
  label,
  size = 'md',
  weight = 'medium'
}: SSNostrKindFilterLabelProps) {
  const { main, suffix } = splitKindFilterLabel(label)
  const trimmed = trimKindFilterParts(main, suffix)
  const rowStyle = inline ? styles.inlineLabel : styles.fullLabel

  if (!trimmed.suffix) {
    return (
      <SSText
        size={size}
        weight={weight}
        numberOfLines={1}
        ellipsizeMode="tail"
        style={rowStyle}
      >
        {trimDropdownLabel(trimmed.main)}
      </SSText>
    )
  }

  return (
    <SSText
      size={size}
      weight={weight}
      numberOfLines={1}
      ellipsizeMode="tail"
      style={rowStyle}
    >
      <SSText size={size} weight={weight}>
        {trimmed.main}
      </SSText>
      <SSText size={size} weight={weight} color="muted">
        {trimmed.suffix}
      </SSText>
    </SSText>
  )
}

type SSNostrKindFilterTriggerProps = {
  label: string
  onPress: () => void
}

export function SSNostrKindFilterTrigger({
  label,
  onPress
}: SSNostrKindFilterTriggerProps) {
  return (
    <Pressable
      hitSlop={NOSTR_KIND_FILTER_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [
        styles.kindFilterTrigger,
        pressed ? styles.kindFilterTriggerPressed : null
      ]}
    >
      <SSHStack gap="xs" style={styles.kindFilterTriggerInner}>
        <SSNostrKindFilterLabel
          inline
          label={label}
          size="xs"
          weight="regular"
        />
        <SSIconChevronDown height={4} width={10} />
      </SSHStack>
    </Pressable>
  )
}

type SSNostrReplyFilterChipProps = {
  active: boolean
  label: string
  onPress: () => void
}

export function SSNostrReplyFilterChip({
  active,
  label,
  onPress
}: SSNostrReplyFilterChipProps) {
  return (
    <Pressable
      hitSlop={NOSTR_KIND_FILTER_HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [
        styles.replyFilterChip,
        pressed ? styles.replyFilterChipPressed : null
      ]}
    >
      <SSText size="xxs" color={active ? 'white' : 'muted'}>
        {label}
      </SSText>
    </Pressable>
  )
}

type SSNostrKindFilterOptionRowProps = {
  label: string
  onClose: () => void
  onSelect: (id: string) => void
  optionId: string
  selected: boolean
}

function SSNostrKindFilterOptionRow({
  label,
  onClose,
  onSelect,
  optionId,
  selected
}: SSNostrKindFilterOptionRowProps) {
  function handlePress() {
    onSelect(optionId)
    onClose()
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.kindOptionRow,
        !selected ? styles.kindOptionRowDimmed : null,
        pressed ? styles.kindOptionRowPressed : null
      ]}
      onPress={handlePress}
    >
      <SSNostrKindFilterLabel
        label={label}
        size="sm"
        weight={selected ? 'medium' : 'regular'}
      />
    </Pressable>
  )
}

type SSNostrKindFilterSheetProps = {
  onClose: () => void
  onSelect: (id: string) => void
  options: NostrNoteKindFilterOption[]
  selectedId: string
  visible: boolean
}

export function SSNostrKindFilterSheet({
  onClose,
  onSelect,
  options,
  selectedId,
  visible
}: SSNostrKindFilterSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.kindSheetOverlay}>
        <Pressable style={styles.kindSheetBackdrop} onPress={onClose} />
        <View style={styles.kindSheet}>
          <View style={styles.kindSheetHandle} />
          <SSVStack gap="sm">
            <SSText size="xs" color="muted" uppercase>
              {t('nostrIdentity.feed.kindFilterSheetTitle')}
            </SSText>
            <ScrollView
              style={styles.kindSheetScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <SSVStack gap="none">
                {options.map((opt) => (
                  <SSNostrKindFilterOptionRow
                    key={opt.id}
                    label={t(opt.labelKey)}
                    onClose={onClose}
                    onSelect={onSelect}
                    optionId={opt.id}
                    selected={opt.id === selectedId}
                  />
                ))}
              </SSVStack>
            </ScrollView>
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={onClose}
            />
          </SSVStack>
        </View>
      </View>
    </Modal>
  )
}

export const ssnostrKindFilterRowStyle = styles.filterRow

const styles = StyleSheet.create({
  filterRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  fullLabel: {
    flex: 1,
    minWidth: 0
  },
  inlineLabel: {
    flexShrink: 1
  },
  kindFilterTrigger: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    marginRight: 8,
    maxWidth: NOSTR_KIND_FILTER_TRIGGER_MAX_WIDTH,
    minHeight: 32,
    paddingVertical: 4
  },
  kindFilterTriggerInner: {
    alignItems: 'center',
    minWidth: 0
  },
  kindFilterTriggerPressed: {
    opacity: 0.65
  },
  kindOptionRow: {
    paddingVertical: 12
  },
  kindOptionRowDimmed: {
    opacity: 0.5
  },
  kindOptionRowPressed: {
    opacity: 0.75
  },
  kindSheet: {
    backgroundColor: Colors.gray[950],
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 10
  },
  kindSheetBackdrop: {
    flex: 1
  },
  kindSheetHandle: {
    alignSelf: 'center',
    backgroundColor: Colors.gray[800],
    borderRadius: 2,
    height: 3,
    marginBottom: 16,
    width: 28
  },
  kindSheetOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'flex-end'
  },
  kindSheetScroll: {
    maxHeight: 380
  },
  replyFilterChip: {
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  replyFilterChipPressed: {
    opacity: 0.65
  }
})
