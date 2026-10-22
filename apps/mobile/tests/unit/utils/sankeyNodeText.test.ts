import { NODE_LABEL_MAX_LENGTH } from '@/constants/sankey'
import { t } from '@/locales'
import { mainGreen, mainRed } from '@/styles/colors'
import {
  getInputOwnershipTag,
  getSankeyNodeParagraphKind,
  getSankeyOutputRole,
  getSpentOutputTag,
  getUnspentOutputTag,
  trimNodeLabel
} from '@/utils/sankeyNodeText'
import { CHART_REMAINING_BALANCE_LOCAL_ID } from '@/utils/stonewall'

const NO_ROLE = {
  isChange: false,
  isFakeMix: false,
  isReceive: false,
  isSelfSend: false
}

const NO_PARAGRAPH_KIND_FLAGS = {
  isBlock: false,
  isInput: false,
  isMiningFee: false,
  isNeutralOutput: false,
  isPrivacyOwnedOutput: false,
  isUnspent: false
}

describe('trimNodeLabel', () => {
  it('keeps short labels', () => {
    expect(trimNodeLabel('savings')).toBe('savings')
  })

  it('cuts long labels and adds an ellipsis', () => {
    const label = 'a'.repeat(NODE_LABEL_MAX_LENGTH + 5)
    expect(trimNodeLabel(label)).toBe(`${'a'.repeat(NODE_LABEL_MAX_LENGTH)}…`)
  })

  it('returns an empty string without a label', () => {
    expect(trimNodeLabel(undefined)).toBe('')
  })
})

describe('getSankeyOutputRole', () => {
  it('treats the stonewall remaining balance as change', () => {
    expect(
      getSankeyOutputRole(
        { isSelfSend: true },
        CHART_REMAINING_BALANCE_LOCAL_ID
      )
    ).toStrictEqual({ ...NO_ROLE, isChange: true })
  })

  it('drops self-send and receive for change outputs', () => {
    expect(
      getSankeyOutputRole(
        { isChange: true, isReceive: true, isSelfSend: true },
        'vout-0'
      )
    ).toStrictEqual({ ...NO_ROLE, isChange: true })
  })

  it('drops self-send and receive for fake mix outputs', () => {
    expect(
      getSankeyOutputRole(
        { isFakeMix: true, isReceive: true, isSelfSend: true },
        'vout-0'
      )
    ).toStrictEqual({ ...NO_ROLE, isFakeMix: true })
  })

  it('drops receive for self-sends', () => {
    expect(
      getSankeyOutputRole({ isReceive: true, isSelfSend: true }, 'vout-0')
    ).toStrictEqual({ ...NO_ROLE, isSelfSend: true })
  })

  it('keeps receive when no other role applies', () => {
    expect(getSankeyOutputRole({ isReceive: true }, undefined)).toStrictEqual({
      ...NO_ROLE,
      isReceive: true
    })
  })
})

describe('getSankeyNodeParagraphKind', () => {
  it('checks block before every other kind', () => {
    expect(
      getSankeyNodeParagraphKind({
        ...NO_PARAGRAPH_KIND_FLAGS,
        isBlock: true,
        isInput: true,
        isMiningFee: true
      })
    ).toBe('block')
  })

  it('checks mining fee before input', () => {
    expect(
      getSankeyNodeParagraphKind({
        ...NO_PARAGRAPH_KIND_FLAGS,
        isInput: true,
        isMiningFee: true
      })
    ).toBe('miningFee')
  })

  it('checks neutral output before unspent output', () => {
    expect(
      getSankeyNodeParagraphKind({
        ...NO_PARAGRAPH_KIND_FLAGS,
        isNeutralOutput: true,
        isUnspent: true
      })
    ).toBe('neutralOutput')
  })

  it('keeps wallet-owned outputs unspent until the UTXO set catches up', () => {
    expect(
      getSankeyNodeParagraphKind({
        ...NO_PARAGRAPH_KIND_FLAGS,
        isPrivacyOwnedOutput: true
      })
    ).toBe('unspentOutput')
  })

  it('falls back to spent output', () => {
    expect(getSankeyNodeParagraphKind(NO_PARAGRAPH_KIND_FLAGS)).toBe(
      'spentOutput'
    )
  })
})

describe('getUnspentOutputTag', () => {
  it('shows the role of change outputs before fake mix', () => {
    expect(
      getUnspentOutputTag(
        { ...NO_ROLE, isChange: true, isFakeMix: true },
        'label'
      )
    ).toBe(t('transaction.build.change'))
  })

  it('shows the role of receive outputs', () => {
    expect(getUnspentOutputTag({ ...NO_ROLE, isReceive: true }, 'label')).toBe(
      t('transaction.build.receive')
    )
  })

  it('shows the trimmed label without a role', () => {
    const label = 'b'.repeat(NODE_LABEL_MAX_LENGTH + 1)
    expect(getUnspentOutputTag(NO_ROLE, label)).toBe(trimNodeLabel(label))
  })
})

describe('getSpentOutputTag', () => {
  it('prefers the special tag', () => {
    expect(getSpentOutputTag('OP_RETURN', 'label')).toBe('OP_RETURN')
  })

  it('shows the label without a special tag', () => {
    expect(getSpentOutputTag(undefined, 'rent')).toBe('rent')
  })

  it('shows the no label text without tag or label', () => {
    expect(getSpentOutputTag(undefined, undefined)).toBe(t('common.noLabel'))
  })
})

describe('getInputOwnershipTag', () => {
  it('tags our inputs in green', () => {
    expect(getInputOwnershipTag(true)).toStrictEqual({
      color: mainGreen,
      text: t('transaction.details.chartInputOurs')
    })
  })

  it('tags counterparty inputs in red', () => {
    expect(getInputOwnershipTag(false)).toStrictEqual({
      color: mainRed,
      text: t('transaction.details.chartInputCounterparty')
    })
  })

  it('has no tag when ownership is unknown', () => {
    expect(getInputOwnershipTag(undefined)).toBeUndefined()
  })
})
