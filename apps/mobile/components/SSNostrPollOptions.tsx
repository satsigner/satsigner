import { ActivityIndicator, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type NostrPollInfo } from '@/types/models/Nostr'
import { buildPollOptionButtonLabel } from '@/utils/nostrPoll'

type SSNostrPollOptionsProps = {
  canVote: boolean
  isExpired: boolean
  onOptionPress: (optionId: string) => void
  onSubmitMultiple: () => void
  pollInfo: NostrPollInfo
  pollMultipleSelection: string[]
  pollResponsesLoading: boolean
  pollVoteCounts: Map<string, number>
  pollVoting: boolean
  userPollVoteIds: string[]
}

export function SSNostrPollOptions({
  canVote,
  isExpired,
  onOptionPress,
  onSubmitMultiple,
  pollInfo,
  pollMultipleSelection,
  pollResponsesLoading,
  pollVoteCounts,
  pollVoting,
  userPollVoteIds
}: SSNostrPollOptionsProps) {
  return (
    <SSVStack gap="sm" style={styles.pollSection}>
      {pollResponsesLoading ? (
        <SSHStack gap="sm" style={styles.loadingRow}>
          <ActivityIndicator color={Colors.white} size="small" />
          <SSText size="xs" color="muted">
            {t('nostrIdentity.note.pollLoading')}
          </SSText>
        </SSHStack>
      ) : null}
      {pollInfo.options.map((option) => {
        const voteCount = pollVoteCounts.get(option.id) ?? 0
        const isSelected =
          pollInfo.pollType === 'multiplechoice'
            ? pollMultipleSelection.includes(option.id)
            : userPollVoteIds.includes(option.id)

        return (
          <SSNostrPollOptionButton
            key={option.id}
            disabled={isExpired || pollVoting || !canVote}
            isSelected={isSelected}
            label={buildPollOptionButtonLabel(option.label, voteCount)}
            onPress={onOptionPress}
            optionId={option.id}
          />
        )
      })}
      {pollInfo.pollType === 'multiplechoice' ? (
        <SSButton
          label={t('nostrIdentity.note.pollSubmitVote')}
          variant="secondary"
          disabled={
            isExpired ||
            pollVoting ||
            pollMultipleSelection.length === 0 ||
            !canVote
          }
          loading={pollVoting}
          onPress={onSubmitMultiple}
        />
      ) : null}
      {isExpired ? (
        <SSText size="xs" color="muted" center>
          {t('nostrIdentity.note.pollExpired')}
        </SSText>
      ) : null}
    </SSVStack>
  )
}

type SSNostrPollOptionButtonProps = {
  disabled: boolean
  isSelected: boolean
  label: string
  onPress: (optionId: string) => void
  optionId: string
}

function SSNostrPollOptionButton({
  disabled,
  isSelected,
  label,
  onPress,
  optionId
}: SSNostrPollOptionButtonProps) {
  function handlePress() {
    onPress(optionId)
  }

  return (
    <SSButton
      label={label}
      variant={isSelected ? 'secondary' : 'outline'}
      disabled={disabled}
      onPress={handlePress}
    />
  )
}

const styles = StyleSheet.create({
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8
  },
  pollSection: {
    marginTop: 4
  }
})

export default SSNostrPollOptions
