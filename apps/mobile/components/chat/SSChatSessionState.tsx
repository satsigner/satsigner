import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native'

import SSDetailRow from '@/components/SSDetailRow'
import SSModal from '@/components/SSModal'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type {
  AgentDetailRow,
  ContextTone,
  SessionStateSummary
} from '@/utils/nostrChatAgent'

const PRESSED_OPACITY = 0.6
const STALE_OPACITY = 0.5
const HIT_SLOP = 6
/** Share of the screen the details may take; the close button stays below. */
const SHEET_MAX_HEIGHT_RATIO = 0.6

const TONE_STYLES: Record<ContextTone, { color: string } | undefined> = {
  error: { color: Colors.error },
  normal: undefined,
  warning: { color: Colors.warning }
}

type SSChatSessionStateLineProps = {
  summary: SessionStateSummary
  onPress: () => void
}

/**
 * One dim line under the session title: what the agent runs on, what the
 * session has cost and the balance left. Wraps to a second line when narrow.
 * A document with nothing for the line still has details, so the line falls
 * back to a label that opens them.
 */
function SSChatSessionStateLine({
  summary,
  onPress
}: SSChatSessionStateLineProps) {
  const line =
    summary.line.length > 0 ? summary.line : t('nostrIdentity.chat.agent.title')
  return (
    <SSPressable
      accessibilityRole="button"
      accessibilityLabel={t('nostrIdentity.chat.agent.open')}
      activeOpacity={PRESSED_OPACITY}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      style={summary.stale ? styles.stale : undefined}
    >
      <SSText
        size="xxs"
        color="muted"
        numberOfLines={2}
        center
        style={TONE_STYLES[summary.contextTone]}
      >
        {summary.busy ? `● ${line}` : line}
      </SSText>
    </SSPressable>
  )
}

type SSChatSessionStateSheetProps = {
  visible: boolean
  rows: AgentDetailRow[]
  summary: SessionStateSummary
  sharedModel: boolean
  onClose: () => void
}

/** Everything the agent reported for this session. Read only. */
function SSChatSessionStateSheet({
  visible,
  rows,
  summary,
  sharedModel,
  onClose
}: SSChatSessionStateSheetProps) {
  const { height } = useWindowDimensions()
  return (
    <SSModal
      visible={visible}
      title={t('nostrIdentity.chat.agent.title')}
      label={t('common.close')}
      onClose={onClose}
    >
      <ScrollView
        style={[styles.sheet, { maxHeight: height * SHEET_MAX_HEIGHT_RATIO }]}
      >
        <SSVStack gap="sm">
          <SSVStack gap="none">
            {rows.map((row) => (
              <SSDetailRow key={row.key} label={row.label} value={row.value} />
            ))}
          </SSVStack>
          {summary.stale ? (
            <SSText size="xs" color="muted">
              {t('nostrIdentity.chat.agent.stale', {
                updated: summary.updated
              })}
            </SSText>
          ) : null}
          {sharedModel ? (
            <SSText size="xs" color="muted">
              {t('nostrIdentity.chat.agent.sharedModel')}
            </SSText>
          ) : null}
          {summary.lowBalance ? (
            <SSText size="xs" style={styles.warning}>
              {t('nostrIdentity.chat.agent.lowBalance')}
            </SSText>
          ) : null}
          <SSText size="xs" color="muted">
            {t('nostrIdentity.chat.agent.reportedByAgent')}
          </SSText>
        </SSVStack>
      </ScrollView>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  sheet: {
    alignSelf: 'stretch'
  },
  stale: {
    opacity: STALE_OPACITY
  },
  warning: {
    color: Colors.warning
  }
})

export { SSChatSessionStateLine, SSChatSessionStateSheet }
