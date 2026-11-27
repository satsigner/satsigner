import type { NostrChatStoredSessionState } from '@/types/models/Nostr'
import { formatNumber } from '@/utils/format'
import {
  buildAgentReplyLabel,
  buildAgentReplyRows,
  buildSessionStateRows,
  buildSessionStateSummary,
  formatAgentTokens,
  formatAgentTokenUsage,
  getContextTone,
  isSessionStateStale,
  parseAgentReplyTags,
  parseSessionStateContent
} from '@/utils/nostrChatAgent'

// The shapes pinned by pi-nip17-bridge docs/satsigner-agent-cost.md.
const COST = {
  amount: 271.67,
  durationMs: 84_210,
  models: ['claude-opus-5.5'],
  requests: 9,
  tokens: { cacheRead: 431_002, cacheWrite: 6120, input: 18, output: 5210 },
  unit: 'sat',
  v: 1
}

const MODEL = {
  id: 'claude-opus-5.5',
  name: 'Anthropic: Claude Opus 5.5',
  provider: 'routstr',
  thinkingLevel: 'medium',
  v: 1
}

const STATE = {
  agent: {
    balance: { apiKeys: 481, low: false, unit: 'sat', wallet: 23_182 },
    name: 'pi',
    provider: 'routstr'
  },
  options: {
    models: [{ id: 'glm-5.3', provider: 'routstr' }],
    thinkingLevels: ['off', 'low']
  },
  session: {
    busy: false,
    cacheHitRate: 0.991,
    context: { autoCompact: true, tokens: 62_110, window: 1_000_000 },
    model: {
      id: 'claude-opus-5.5',
      name: 'Anthropic: Claude Opus 5.5',
      provider: 'routstr',
      reasoning: true,
      vision: true
    },
    sharedModel: true,
    spent: { amount: 1874.2, unit: 'sat' },
    thinkingLevel: 'medium',
    tokens: {
      cacheRead: 2_100_000,
      cacheWrite: 64_000,
      input: 120,
      output: 41_000
    }
  },
  v: 1
}

const NOW_MS = 1_700_000_000_000
const UPDATED_AT = NOW_MS / 1000 - 120

const DISPLAY = {
  btcPrice: 0,
  fiatCurrency: 'USD' as const,
  fiatEnabled: false,
  privacyMode: false
}

function tags(cost: unknown, model: unknown): string[][] {
  return [
    ['p', 'a'.repeat(64)],
    ['agent_cost', typeof cost === 'string' ? cost : JSON.stringify(cost)],
    ['agent_model', typeof model === 'string' ? model : JSON.stringify(model)]
  ]
}

function stored(state: unknown): NostrChatStoredSessionState {
  const parsed = parseSessionStateContent(JSON.stringify(state))
  if (!parsed) {
    throw new Error('expected a valid document')
  }
  return { state: parsed, updatedAt: UPDATED_AT }
}

function rowValues(rows: { key: string; value: string }[]) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

describe('parseAgentReplyTags', () => {
  it('reads the cost and model tags of a reply', () => {
    expect(parseAgentReplyTags(tags(COST, MODEL))).toStrictEqual({
      agentCost: COST,
      agentModel: MODEL
    })
  })

  it('reads none on a message without the tags', () => {
    expect(parseAgentReplyTags([['p', 'a'.repeat(64)]])).toStrictEqual({})
    expect(parseAgentReplyTags(undefined)).toStrictEqual({})
  })

  it('keeps the model when the cost is missing', () => {
    expect(
      parseAgentReplyTags([['agent_model', JSON.stringify(MODEL)]])
    ).toStrictEqual({ agentModel: MODEL })
  })

  it('ignores a tag that is not JSON', () => {
    expect(parseAgentReplyTags(tags('{nope', MODEL))).toStrictEqual({
      agentModel: MODEL
    })
  })

  it('ignores an unknown schema version or unit', () => {
    expect(
      parseAgentReplyTags(tags({ ...COST, v: 2 }, { ...MODEL, v: 2 }))
    ).toStrictEqual({})
    expect(
      parseAgentReplyTags(tags({ ...COST, unit: 'usd' }, MODEL)).agentCost
    ).toBeUndefined()
  })

  it('refuses amounts and counts out of range', () => {
    const bad = [
      { ...COST, amount: -1 },
      { ...COST, amount: 10_000_001 },
      { ...COST, requests: 0 },
      { ...COST, requests: 1.5 },
      { ...COST, requests: 10_001 },
      { ...COST, amount: 'lots' }
    ]
    for (const cost of bad) {
      expect(parseAgentReplyTags(tags(cost, MODEL)).agentCost).toBeUndefined()
    }
  })

  it('drops a bad optional field and keeps the rest', () => {
    const { agentCost } = parseAgentReplyTags(
      tags({ ...COST, durationMs: -5, tokens: { input: -1, output: 3 } }, MODEL)
    )
    expect(agentCost?.durationMs).toBeUndefined()
    expect(agentCost?.tokens?.input).toBeUndefined()
    expect(agentCost?.tokens?.output).toBe(3)
    expect(agentCost?.amount).toBe(COST.amount)
  })

  it('caps the model id and drops unknown fields', () => {
    expect(
      parseAgentReplyTags(tags(COST, { ...MODEL, id: 'x'.repeat(81) }))
        .agentModel
    ).toBeUndefined()
    const { agentModel } = parseAgentReplyTags(
      tags(COST, { ...MODEL, href: 'https://evil.example' })
    )
    expect(agentModel).not.toHaveProperty('href')
    expect(agentModel?.id).toBe(MODEL.id)
  })

  it('ignores a tag over 2 KB', () => {
    const padded = { ...COST, pad: 'x'.repeat(2048) }
    expect(parseAgentReplyTags(tags(padded, MODEL)).agentCost).toBeUndefined()
  })
})

describe('parseSessionStateContent', () => {
  it('reads the bridge document and drops what it does not show', () => {
    const parsed = parseSessionStateContent(JSON.stringify(STATE))
    expect(parsed?.session?.spent?.amount).toBe(1874.2)
    expect(parsed?.session?.sharedModel).toBe(true)
    expect(parsed).not.toHaveProperty('options')
  })

  it('keeps a document with a bad field, without that field', () => {
    const parsed = parseSessionStateContent(
      JSON.stringify({
        ...STATE,
        session: { ...STATE.session, cacheHitRate: 7, context: 'big' }
      })
    )
    expect(parsed?.session?.cacheHitRate).toBeUndefined()
    expect(parsed?.session?.context).toBeUndefined()
    expect(parsed?.session?.model?.id).toBe('claude-opus-5.5')
  })

  it('refuses a document with an amount in another unit', () => {
    const usdSpent = {
      ...STATE,
      session: {
        ...STATE.session,
        spent: { ...STATE.session.spent, unit: 'usd' }
      }
    }
    const usdBalance = {
      ...STATE,
      agent: {
        ...STATE.agent,
        balance: { ...STATE.agent.balance, unit: 'usd' }
      }
    }
    expect(parseSessionStateContent(JSON.stringify(usdSpent))).toBeUndefined()
    expect(parseSessionStateContent(JSON.stringify(usdBalance))).toBeUndefined()
  })

  it('refuses another version, bad JSON and oversized content', () => {
    expect(
      parseSessionStateContent(JSON.stringify({ ...STATE, v: 2 }))
    ).toBeUndefined()
    expect(parseSessionStateContent('not json')).toBeUndefined()
    expect(
      parseSessionStateContent(
        JSON.stringify({ ...STATE, pad: 'x'.repeat(16_384) })
      )
    ).toBeUndefined()
  })
})

describe('formatting', () => {
  it('formats token counts like the pi footer', () => {
    expect(formatAgentTokens(24)).toBe('24')
    expect(formatAgentTokens(3000)).toBe('3k')
    expect(formatAgentTokens(5210)).toBe('5.2k')
    expect(formatAgentTokens(125_000)).toBe('125k')
    expect(formatAgentTokens(1_000_000)).toBe('1M')
    expect(formatAgentTokens(2_100_000)).toBe('2.1M')
  })

  it('formats token usage, skipping what is missing', () => {
    expect(formatAgentTokenUsage(COST.tokens)).toBe('↑18 ↓5.2k R431k W6.1k')
    expect(formatAgentTokenUsage({ output: 3000 })).toBe('↓3k')
  })

  it('warns at 70% of the context and errors at 90%', () => {
    expect(getContextTone(undefined)).toBe('normal')
    expect(getContextTone(0.69)).toBe('normal')
    expect(getContextTone(0.7)).toBe('warning')
    expect(getContextTone(0.9)).toBe('error')
  })

  it('goes stale after 10 minutes', () => {
    expect(isSessionStateStale(NOW_MS / 1000 - 599, NOW_MS)).toBe(false)
    expect(isSessionStateStale(NOW_MS / 1000 - 601, NOW_MS)).toBe(true)
  })
})

describe('buildSessionStateSummary', () => {
  it('reads model, thinking, context and session spend', () => {
    expect(
      buildSessionStateSummary(stored(STATE), NOW_MS, false)
    ).toStrictEqual({
      busy: false,
      contextTone: 'normal',
      line: 'claude-opus-5.5 · medium · 6.2% of 1M · 1.9k sats',
      lowBalance: false,
      stale: false,
      updated: '2m ago'
    })
  })

  it('masks the spend in privacy mode', () => {
    expect(buildSessionStateSummary(stored(STATE), NOW_MS, true).line).toBe(
      'claude-opus-5.5 · medium · 6.2% of 1M · ••••'
    )
  })

  it('shows a partial spend as a lower bound', () => {
    const state = {
      ...STATE,
      session: {
        ...STATE.session,
        spent: { amount: 1874.2, partial: true, unit: 'sat' }
      }
    }
    expect(
      buildSessionStateSummary(stored(state), NOW_MS, false).line
    ).toContain('1.8k+ sats')
  })

  it('skips the context after a compaction and thinking without reasoning', () => {
    const state = {
      ...STATE,
      session: {
        ...STATE.session,
        context: { autoCompact: true, window: 1_000_000 },
        thinkingLevel: undefined
      }
    }
    expect(buildSessionStateSummary(stored(state), NOW_MS, false).line).toBe(
      'claude-opus-5.5 · 1.9k sats'
    )
  })

  it('flags a full context, a busy agent and a low balance', () => {
    const state = {
      agent: { balance: { low: true, unit: 'sat', wallet: 10 } },
      session: { busy: true, context: { tokens: 950, window: 1000 } },
      v: 1
    }
    expect(
      buildSessionStateSummary(stored(state), NOW_MS, false)
    ).toMatchObject({ busy: true, contextTone: 'error', lowBalance: true })
  })
})

describe('buildSessionStateRows', () => {
  it('lists what the agent reported', () => {
    expect(
      rowValues(buildSessionStateRows(stored(STATE), NOW_MS, DISPLAY))
    ).toStrictEqual({
      balance: `${formatNumber(23_663)} sats`,
      cacheHit: '99.1%',
      context: '62k (6.2% of 1M) · auto-compact',
      model: 'Anthropic: Claude Opus 5.5 (routstr)',
      spent: `${formatNumber(1874)} sats`,
      status: 'Idle',
      thinking: 'medium',
      tokens: '↑120 ↓41k R2.1M W64k',
      updated: '2m ago'
    })
  })

  it('adds fiat when enabled and masks amounts in privacy mode', () => {
    const fiatDisplay = { ...DISPLAY, btcPrice: 100_000, fiatEnabled: true }
    const fiat = rowValues(
      buildSessionStateRows(stored(STATE), NOW_MS, fiatDisplay)
    )
    expect(fiat.spent).toBe(`${formatNumber(1874)} sats (≈ 1.87 USD)`)
    const masked = rowValues(
      buildSessionStateRows(stored(STATE), NOW_MS, {
        ...fiatDisplay,
        privacyMode: true
      })
    )
    expect(masked.spent).toBe('••••')
    expect(masked.balance).toBe('••••')
  })

  it('rounds a partial spend down, as it is a lower bound', () => {
    const state = {
      ...STATE,
      session: {
        ...STATE.session,
        spent: { amount: 1874.8, partial: true, unit: 'sat' }
      }
    }
    expect(
      rowValues(buildSessionStateRows(stored(state), NOW_MS, DISPLAY)).spent
    ).toBe(`≥ ${formatNumber(1874)} sats`)
  })
})

describe('agent reply', () => {
  it('labels a reply with its model, thinking level and cost', () => {
    expect(
      buildAgentReplyLabel({ agentCost: COST, agentModel: MODEL }, false)
    ).toBe('claude-opus-5.5 · medium · 272 sats')
  })

  it('shows a partial cost as a lower bound and masks it in privacy mode', () => {
    const partial = { ...COST, partial: true as const }
    expect(buildAgentReplyLabel({ agentCost: partial }, false)).toBe(
      '271+ sats'
    )
    expect(buildAgentReplyLabel({ agentCost: COST }, true)).toBe('••••')
  })

  it('has no label without either tag', () => {
    expect(buildAgentReplyLabel({}, false)).toBeUndefined()
  })

  it('lists the reply details', () => {
    expect(
      rowValues(
        buildAgentReplyRows({ agentCost: COST, agentModel: MODEL }, DISPLAY)
      )
    ).toStrictEqual({
      cost: '272 sats',
      duration: '84 s',
      model: 'Anthropic: Claude Opus 5.5 (routstr)',
      modelsUsed: 'claude-opus-5.5',
      requests: '9',
      thinking: 'medium',
      tokens: '↑18 ↓5.2k R431k W6.1k'
    })
  })
})
