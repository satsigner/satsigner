import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrSignRequest } from '@/types/models/Nostr'
import type {
  Nip46EventSummary,
  SignBatchView
} from '@/utils/nip46EventSummary'

type SSChatSignRequestCardProps = {
  view: SignBatchView
  signerLabel: string
  busy: boolean
  canSign: boolean
  messageId: string
  onApprove: (messageId: string) => void
  onReject: (messageId: string) => void
  onResend: (messageId: string) => void
}

function stateLabel(view: SignBatchView): string {
  switch (view.state) {
    case 'answered': {
      return t('nip46.chat.stateAnswered')
    }
    case 'decided': {
      return t('nip46.chat.stateNotSent')
    }
    case 'expired': {
      return t('nip46.chat.stateExpired')
    }
    case 'invalid': {
      return t('nip46.chat.stateInvalid')
    }
    default: {
      return t('nip46.chat.statePending')
    }
  }
}

/** The raw request, in full: a summary never hides what gets signed. */
function RawRequest({ request }: { request: NostrSignRequest }) {
  return (
    <SSVStack gap="xxs" style={styles.raw}>
      <SSText size="xxs" color="muted">
        {request.method}
      </SSText>
      {request.params.map((param, index) => (
        <SSText key={index} size="xxs" selectable>
          {param}
        </SSText>
      ))}
    </SSVStack>
  )
}

function RequestRow({
  request,
  summary
}: {
  request: NostrSignRequest
  summary: Nip46EventSummary
}) {
  const [expanded, setExpanded] = useState(false)

  function toggle() {
    setExpanded(!expanded)
  }

  return (
    <SSVStack gap="xxs" style={styles.request}>
      <SSHStack justifyBetween>
        <SSText size="sm" weight="medium">
          {summary.title}
        </SSText>
        {request.status === 'invalid' && request.error ? (
          <SSText size="xs" style={styles.warning}>
            {request.error}
          </SSText>
        ) : null}
      </SSHStack>
      {summary.lines.map((line) => (
        <SSText key={line.label} size="xs" color="muted" selectable>
          {`${line.label}: ${line.value}`}
        </SSText>
      ))}
      {summary.warning ? (
        <SSText size="xs" style={styles.warning}>
          {summary.warning}
        </SSText>
      ) : null}
      <SSButton
        label={
          expanded ? t('nip46.chat.hideDetails') : t('nip46.chat.showDetails')
        }
        variant="ghost"
        onPress={toggle}
      />
      {expanded ? <RawRequest request={request} /> : null}
    </SSVStack>
  )
}

function SSChatSignRequestCard({
  view,
  signerLabel,
  busy,
  canSign,
  messageId,
  onApprove,
  onReject,
  onResend
}: SSChatSignRequestCardProps) {
  const count = view.items.length

  function approve() {
    onApprove(messageId)
  }

  function reject() {
    onReject(messageId)
  }

  function resend() {
    onResend(messageId)
  }

  return (
    <View style={[styles.card, view.highRisk && styles.cardHighRisk]}>
      <SSVStack gap="xs">
        <SSText size="xs" color="muted" uppercase>
          {t('nip46.chat.title', { count })}
        </SSText>
        {view.label ? (
          <SSText size="sm" weight="medium">
            {view.label}
          </SSText>
        ) : null}
        <SSText size="xs" color="muted">
          {t('nip46.chat.signer', { name: signerLabel })}
        </SSText>
        {view.highRisk ? (
          <SSText size="xs" style={styles.warning}>
            {t('nip46.chat.highRisk')}
          </SSText>
        ) : null}
        {view.items.map(({ request, summary }) => (
          <RequestRow
            key={request.requestId}
            request={request}
            summary={summary}
          />
        ))}
        <SSText size="xs" color="muted">
          {stateLabel(view)}
        </SSText>
        {canSign && view.state === 'pending' ? (
          <SSVStack gap="xs">
            <SSButton
              label={t('nip46.chat.approve', { count })}
              variant={view.highRisk ? 'danger' : 'secondary'}
              loading={busy}
              onPress={approve}
            />
            <SSButton
              label={t('nip46.approval.reject')}
              variant="outline"
              disabled={busy}
              onPress={reject}
            />
          </SSVStack>
        ) : null}
        {canSign && view.state === 'invalid' ? (
          <SSButton
            label={t('nip46.chat.decline')}
            variant="outline"
            loading={busy}
            onPress={reject}
          />
        ) : null}
        {canSign && view.state === 'decided' ? (
          <SSButton
            label={t('nip46.chat.resend')}
            variant="outline"
            loading={busy}
            onPress={resend}
          />
        ) : null}
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    padding: 12
  },
  cardHighRisk: {
    borderColor: Colors.error
  },
  raw: {
    backgroundColor: Colors.gray[950],
    borderRadius: 4,
    padding: 8
  },
  request: {
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    paddingTop: 6
  },
  warning: {
    color: Colors.error
  }
})

export default SSChatSignRequestCard
