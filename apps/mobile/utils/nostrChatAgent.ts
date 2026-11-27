import type { z } from 'zod'

import {
  NOSTR_CHAT_AGENT_COST_TAG,
  NOSTR_CHAT_AGENT_MODEL_TAG,
  NOSTR_CHAT_AGENT_TAG_MAX_BYTES,
  NOSTR_CHAT_CONTEXT_ERROR_RATIO,
  NOSTR_CHAT_CONTEXT_WARNING_RATIO,
  NOSTR_CHAT_STATE_MAX_BYTES,
  NOSTR_CHAT_STATE_STALE_MS,
  NOSTR_PRIVACY_MASK
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { t } from '@/locales'
import {
  NostrChatAgentCostSchema,
  NostrChatAgentModelSchema,
  NostrChatSessionStateSchema
} from '@/types/models/Nostr'
import type {
  NostrChatAgentCost,
  NostrChatAgentModel,
  NostrChatAgentTokens,
  NostrChatSessionState,
  NostrChatStoredSessionState
} from '@/types/models/Nostr'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import { formatFiatPrice, formatNumber, formatShortSats } from '@/utils/format'
import { getNostrTagValue } from '@/utils/nostrEvent'
import { formatCreatedRelative } from '@/utils/relativeTime'

const THOUSAND = 1000
const MILLION = 1_000_000
const TEN = 10
const PERCENT = 100
const SEPARATOR = ' · '

type ContextTone = 'error' | 'normal' | 'warning'

type AgentDetailRow = { key: string; label: string; value: string }

type AgentReplyInfo = {
  agentCost?: NostrChatAgentCost
  agentModel?: NostrChatAgentModel
}

type SessionStateSummary = {
  busy: boolean
  contextTone: ContextTone
  line: string
  lowBalance: boolean
  stale: boolean
  updated: string
}

type AmountDisplay = Pick<
  DisplayPreferences,
  'btcPrice' | 'fiatCurrency' | 'fiatEnabled' | 'privacyMode'
>

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function parseJsonSafely(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function parseCapped<T extends z.ZodType>(
  value: string | undefined,
  maxBytes: number,
  schema: T
): z.infer<T> | undefined {
  if (value === undefined || byteLength(value) > maxBytes) {
    return undefined
  }
  const parsed = schema.safeParse(parseJsonSafely(value))
  return parsed.success ? parsed.data : undefined
}

/** The `agent_cost` and `agent_model` tags of a reply; a bad tag is ignored. */
function parseAgentReplyTags(tags: unknown): AgentReplyInfo {
  const agentCost = parseCapped(
    getNostrTagValue(tags, NOSTR_CHAT_AGENT_COST_TAG),
    NOSTR_CHAT_AGENT_TAG_MAX_BYTES,
    NostrChatAgentCostSchema
  )
  const agentModel = parseCapped(
    getNostrTagValue(tags, NOSTR_CHAT_AGENT_MODEL_TAG),
    NOSTR_CHAT_AGENT_TAG_MAX_BYTES,
    NostrChatAgentModelSchema
  )
  return {
    ...(agentCost ? { agentCost } : {}),
    ...(agentModel ? { agentModel } : {})
  }
}

function parseSessionStateContent(
  content: string
): NostrChatSessionState | undefined {
  return parseCapped(
    content,
    NOSTR_CHAT_STATE_MAX_BYTES,
    NostrChatSessionStateSchema
  )
}

function trimDecimal(value: number): string {
  const rounded =
    value < TEN ? Math.round(value * TEN) / TEN : Math.round(value)
  return String(rounded)
}

/** Pi footer style: 24, 3k, 5.2k, 125k, 1M, 2.1M. */
function formatAgentTokens(count: number): string {
  if (count < THOUSAND) {
    return String(count)
  }
  if (count < MILLION) {
    return `${trimDecimal(count / THOUSAND)}k`
  }
  return `${trimDecimal(count / MILLION)}M`
}

function formatAgentPercent(ratio: number): string {
  return `${Math.round(ratio * PERCENT * TEN) / TEN}%`
}

/** ↑ input ↓ output R cache read W cache write, as in the pi footer. */
function formatAgentTokenUsage(tokens: NostrChatAgentTokens): string {
  const parts: [string, number | undefined][] = [
    ['↑', tokens.input],
    ['↓', tokens.output],
    ['R', tokens.cacheRead],
    ['W', tokens.cacheWrite]
  ]
  return parts
    .filter((part): part is [string, number] => part[1] !== undefined)
    .map(([prefix, count]) => `${prefix}${formatAgentTokens(count)}`)
    .join(' ')
}

function formatAgentSats(
  amount: number,
  privacyMode: boolean,
  lowerBound = false
): string {
  return privacyMode ? NOSTR_PRIVACY_MASK : formatShortSats(amount, lowerBound)
}

/** Exact sats, with the fiat value when the user wants it and it isn't masked. */
function formatAgentSatsDetail(
  amount: number,
  display: AmountDisplay,
  lowerBound = false
): string {
  if (display.privacyMode) {
    return NOSTR_PRIVACY_MASK
  }
  const prefix = lowerBound ? '≥ ' : ''
  const whole = lowerBound ? Math.floor(amount) : Math.round(amount)
  const sats = `${prefix}${formatNumber(whole)} ${t('bitcoin.sats')}`
  if (!display.fiatEnabled || display.btcPrice <= 0) {
    return sats
  }
  return `${sats} (≈ ${formatFiatPrice(amount, display.btcPrice)} ${display.fiatCurrency})`
}

function getContextRatio(state: NostrChatSessionState): number | undefined {
  const context = state.session?.context
  if (context?.tokens === undefined || context.window === undefined) {
    return undefined
  }
  return context.tokens / context.window
}

function getContextTone(ratio: number | undefined): ContextTone {
  if (ratio === undefined || ratio < NOSTR_CHAT_CONTEXT_WARNING_RATIO) {
    return 'normal'
  }
  return ratio < NOSTR_CHAT_CONTEXT_ERROR_RATIO ? 'warning' : 'error'
}

function formatContextShare(state: NostrChatSessionState): string | undefined {
  const ratio = getContextRatio(state)
  const window = state.session?.context?.window
  if (ratio === undefined || window === undefined) {
    return undefined
  }
  return t('nostrIdentity.chat.agent.contextShare', {
    percent: formatAgentPercent(ratio),
    window: formatAgentTokens(window)
  })
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value.length > 0
}

function isSessionStateStale(updatedAt: number, nowMs: number): boolean {
  return nowMs - updatedAt * MS_PER_SECOND > NOSTR_CHAT_STATE_STALE_MS
}

/** Wallet plus API keys, the sats the agent can still spend. */
function getBalanceTotal(state: NostrChatSessionState): number | undefined {
  const balance = state.agent?.balance
  if (balance?.wallet === undefined && balance?.apiKeys === undefined) {
    return undefined
  }
  return (balance.wallet ?? 0) + (balance.apiKeys ?? 0)
}

/**
 * The thread header line: model · thinking · context share · session spend ·
 * agent balance. Fields the agent left out are skipped, so a partial document
 * still reads.
 */
function buildSessionStateSummary(
  { state, updatedAt }: NostrChatStoredSessionState,
  nowMs: number,
  privacyMode: boolean
): SessionStateSummary {
  const { session } = state
  const spent = session?.spent
  const balance = getBalanceTotal(state)
  const line = [
    session?.model?.id,
    session?.thinkingLevel,
    formatContextShare(state),
    spent
      ? t('nostrIdentity.chat.agent.spentShort', {
          amount: formatAgentSats(spent.amount, privacyMode, spent.partial)
        })
      : undefined,
    balance === undefined
      ? undefined
      : t('nostrIdentity.chat.agent.balanceShort', {
          amount: formatAgentSats(balance, privacyMode)
        })
  ]
    .filter(isPresent)
    .join(SEPARATOR)
  return {
    busy: session?.busy === true,
    contextTone: getContextTone(getContextRatio(state)),
    line,
    lowBalance: state.agent?.balance?.low === true,
    stale: isSessionStateStale(updatedAt, nowMs),
    updated: formatCreatedRelative(updatedAt * MS_PER_SECOND, nowMs)
  }
}

function row(
  key: string,
  value: string | undefined
): AgentDetailRow | undefined {
  return isPresent(value)
    ? { key, label: t(`nostrIdentity.chat.agent.rows.${key}`), value }
    : undefined
}

function isRow(value: AgentDetailRow | undefined): value is AgentDetailRow {
  return value !== undefined
}

function formatModelName(model: {
  id: string
  name?: string
  provider: string
}): string {
  const name = model.name ?? model.id
  return `${name} (${model.provider})`
}

function formatContextDetail(state: NostrChatSessionState): string | undefined {
  const context = state.session?.context
  if (context?.tokens === undefined) {
    return undefined
  }
  const share = formatContextShare(state)
  const used = formatAgentTokens(context.tokens)
  const base = share ? `${used} (${share})` : used
  return context.autoCompact
    ? `${base}${SEPARATOR}${t('nostrIdentity.chat.agent.autoCompact')}`
    : base
}

function formatBalance(
  state: NostrChatSessionState,
  display: AmountDisplay
): string | undefined {
  const total = getBalanceTotal(state)
  return total === undefined ? undefined : formatAgentSatsDetail(total, display)
}

function formatBusy(state: NostrChatSessionState): string | undefined {
  const busy = state.session?.busy
  if (busy === undefined) {
    return undefined
  }
  return busy
    ? t('nostrIdentity.chat.agent.working')
    : t('nostrIdentity.chat.agent.idle')
}

/** Everything the agent reported, for the session state sheet. */
function buildSessionStateRows(
  { state, updatedAt }: NostrChatStoredSessionState,
  nowMs: number,
  display: AmountDisplay
): AgentDetailRow[] {
  const { session } = state
  const spent = session?.spent
  return [
    row('model', session?.model ? formatModelName(session.model) : undefined),
    row('thinking', session?.thinkingLevel),
    row('context', formatContextDetail(state)),
    row(
      'tokens',
      session?.tokens ? formatAgentTokenUsage(session.tokens) : undefined
    ),
    row(
      'cacheHit',
      session?.cacheHitRate === undefined
        ? undefined
        : formatAgentPercent(session.cacheHitRate)
    ),
    row(
      'spent',
      spent
        ? formatAgentSatsDetail(spent.amount, display, spent.partial)
        : undefined
    ),
    row('balance', formatBalance(state, display)),
    row('status', formatBusy(state)),
    row('updated', formatCreatedRelative(updatedAt * MS_PER_SECOND, nowMs))
  ].filter(isRow)
}

/** Dim line under an agent reply: model · thinking · cost. */
function buildAgentReplyLabel(
  { agentCost, agentModel }: AgentReplyInfo,
  privacyMode: boolean
): string | undefined {
  const label = [
    agentModel?.id,
    agentModel?.thinkingLevel,
    agentCost
      ? formatAgentSats(agentCost.amount, privacyMode, agentCost.partial)
      : undefined
  ]
    .filter(isPresent)
    .join(SEPARATOR)
  return label.length > 0 ? label : undefined
}

function formatDuration(ms: number): string {
  return t('nostrIdentity.chat.agent.seconds', {
    seconds: trimDecimal(ms / MS_PER_SECOND)
  })
}

/** Cost and model of one reply, for the message detail page. */
function buildAgentReplyRows(
  { agentCost, agentModel }: AgentReplyInfo,
  display: AmountDisplay
): AgentDetailRow[] {
  const used = agentModel?.used ?? agentCost?.models
  return [
    row('model', agentModel ? formatModelName(agentModel) : undefined),
    row('thinking', agentModel?.thinkingLevel),
    row('modelsUsed', used && used.length > 0 ? used.join(', ') : undefined),
    row(
      'cost',
      agentCost
        ? formatAgentSatsDetail(agentCost.amount, display, agentCost.partial)
        : undefined
    ),
    row('requests', agentCost ? String(agentCost.requests) : undefined),
    row(
      'tokens',
      agentCost?.tokens ? formatAgentTokenUsage(agentCost.tokens) : undefined
    ),
    row(
      'duration',
      agentCost?.durationMs === undefined
        ? undefined
        : formatDuration(agentCost.durationMs)
    )
  ].filter(isRow)
}

export {
  buildAgentReplyLabel,
  buildAgentReplyRows,
  buildSessionStateRows,
  buildSessionStateSummary,
  formatAgentPercent,
  formatAgentTokens,
  formatAgentTokenUsage,
  getContextTone,
  isSessionStateStale,
  parseAgentReplyTags,
  parseSessionStateContent
}
export type { AgentDetailRow, AgentReplyInfo, ContextTone, SessionStateSummary }
