import {
  ActivityIndicator,
  type LayoutChangeEvent,
  StyleSheet,
  View
} from 'react-native'

import SSButton from '@/components/SSButton'
import SSNostrReactionGlyph from '@/components/SSNostrReactionGlyph'
import SSNostrReactionRow from '@/components/SSNostrReactionRow'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import {
  type NostrReactionRow,
  type NostrReactionSummaryEntry
} from '@/types/models/Nostr'

type SSNostrNoteReactionsProps = {
  authorPressDisabled?: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
  onAuthorPress: (authorNpub: string) => void
  onLayout?: (event: LayoutChangeEvent) => void
  onLoadMore: () => void
  rows: NostrReactionRow[]
  summary: NostrReactionSummaryEntry[]
}

function SSNostrNoteReactions({
  authorPressDisabled,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  onAuthorPress,
  onLayout,
  onLoadMore,
  rows,
  summary
}: SSNostrNoteReactionsProps) {
  return (
    <View onLayout={onLayout}>
      <SSVStack gap="sm">
        <SSText size="xs" color="muted" uppercase>
          {t('nostrIdentity.note.reactions.title')} ({rows.length})
        </SSText>
        {summary.length > 0 ? (
          <SSHStack gap="xs" style={styles.chips}>
            {summary.map((entry) => (
              <SSHStack key={entry.reaction.key} gap="xs" style={styles.chip}>
                <SSNostrReactionGlyph reaction={entry.reaction} />
                <SSText size="xs">{entry.count}</SSText>
              </SSHStack>
            ))}
          </SSHStack>
        ) : null}
        {rows.map((row) => (
          <SSNostrReactionRow
            key={row.id}
            disabled={authorPressDisabled}
            onPress={onAuthorPress}
            row={row}
          />
        ))}
        {isLoading ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : null}
        {!isLoading && rows.length === 0 ? (
          <SSText size="xs" color="muted" center>
            {t('nostrIdentity.note.reactions.empty')}
          </SSText>
        ) : null}
        {hasNextPage ? (
          <SSButton
            label={t('nostrIdentity.note.reactions.loadMore')}
            loading={isFetchingNextPage}
            onPress={onLoadMore}
            variant="subtle"
          />
        ) : null}
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  chips: {
    flexWrap: 'wrap'
  }
})

export default SSNostrNoteReactions
