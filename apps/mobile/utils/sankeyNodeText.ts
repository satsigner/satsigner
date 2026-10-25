import { NODE_LABEL_MAX_LENGTH } from '@/constants/sankey'
import type { TxNode } from '@/hooks/useNodesAndLinks'
import { t } from '@/locales'
import { mainGreen, mainRed } from '@/styles/colors'
import type { SankeyOutputRole } from '@/types/ui/sankey'
import { CHART_REMAINING_BALANCE_LOCAL_ID } from '@/utils/stonewall'

type SankeyNodeParagraphKindFlags = {
  isBlock: boolean
  isMiningFee: boolean
  isInput: boolean
  isNeutralOutput: boolean
  isUnspent: boolean
  isPrivacyOwnedOutput: boolean
}

function trimNodeLabel(label: string | undefined) {
  if (!label) {
    return ''
  }
  if (label.length <= NODE_LABEL_MAX_LENGTH) {
    return label
  }
  return `${label.slice(0, NODE_LABEL_MAX_LENGTH)}…`
}

function getSankeyOutputRole(
  ioData: TxNode['ioData'],
  localId: string | undefined
): SankeyOutputRole {
  const isChange =
    ioData.isChange === true || localId === CHART_REMAINING_BALANCE_LOCAL_ID
  const isFakeMix = ioData.isFakeMix === true
  const isSelfSend = ioData.isSelfSend === true && !isChange && !isFakeMix
  const isReceive =
    ioData.isReceive === true && !isChange && !isFakeMix && !isSelfSend

  return { isChange, isFakeMix, isReceive, isSelfSend }
}

function getSankeyNodeParagraphKind({
  isBlock,
  isMiningFee,
  isInput,
  isNeutralOutput,
  isUnspent,
  isPrivacyOwnedOutput
}: SankeyNodeParagraphKindFlags) {
  if (isBlock) {
    return 'block'
  }
  if (isMiningFee) {
    return 'miningFee'
  }
  if (isInput) {
    return 'input'
  }
  if (isNeutralOutput) {
    return 'neutralOutput'
  }
  // Wallet-owned outputs keep green styling if UTXO set has not caught up.
  if (isUnspent || isPrivacyOwnedOutput) {
    return 'unspentOutput'
  }
  return 'spentOutput'
}

function getUnspentOutputTag(
  role: SankeyOutputRole,
  label: string | undefined
) {
  if (role.isChange) {
    return t('transaction.build.change')
  }
  if (role.isFakeMix) {
    return t('transaction.build.fakeMix')
  }
  if (role.isSelfSend) {
    return t('transaction.build.selfSend')
  }
  if (role.isReceive) {
    return t('transaction.build.receive')
  }
  return trimNodeLabel(label)
}

function getSpentOutputTag(
  specialTag: string | undefined,
  label: string | undefined
) {
  if (specialTag) {
    return specialTag
  }
  if (label) {
    return trimNodeLabel(label)
  }
  return t('common.noLabel')
}

function getInputOwnershipTag(isOwnInput: boolean | undefined) {
  if (isOwnInput === undefined) {
    return undefined
  }
  if (isOwnInput) {
    return {
      color: mainGreen,
      text: t('transaction.details.chartInputOurs')
    }
  }
  return {
    color: mainRed,
    text: t('transaction.details.chartInputCounterparty')
  }
}

export {
  getInputOwnershipTag,
  getSankeyNodeParagraphKind,
  getSankeyOutputRole,
  getSpentOutputTag,
  getUnspentOutputTag,
  trimNodeLabel
}
