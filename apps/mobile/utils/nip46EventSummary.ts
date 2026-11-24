import * as nostrKinds from 'nostr-tools/kinds'

import {
  NOSTR_BLOSSOM_AUTH_KIND,
  NOSTR_REPLACEABLE_LIST_KIND_MAX,
  NOSTR_REPLACEABLE_LIST_KIND_MIN,
  NOSTR_SIGN_HIGH_RISK_KINDS,
  NOSTR_ZAPSTORE_APP_KIND,
  NOSTR_ZAPSTORE_ASSET_KIND,
  NOSTR_ZAPSTORE_CERT_HASH_TAG,
  NOSTR_ZAPSTORE_RELEASE_KIND,
  SATSIGNER_RELEASE_CERT_SHA256
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { PACKAGE_ID_DEV, PACKAGE_ID_PROD } from '@/constants/variant'
import { t } from '@/locales'
import type { Nip46Method, NostrSignRequest } from '@/types/models/Nostr'
import { getSignRequestEvent } from '@/utils/signingQueue'

type SummaryLine = { label: string; value: string }

/**
 * What the card says about one request: a title, readable facts, and how
 * loud the warning is. The raw event is always shown next to it; a summary
 * never replaces it.
 */
type Nip46EventSummary = {
  lines: SummaryLine[]
  risk: 'high' | 'normal'
  title: string
  warning?: string
}

type EventTemplate = NonNullable<ReturnType<typeof getSignRequestEvent>>

function tagValue(tags: string[][], name: string): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1]
}

function tagValues(tags: string[][], name: string): string[] {
  return tags.filter((tag) => tag[0] === name).map((tag) => tag[1] ?? '')
}

function line(label: string, value: string | undefined): SummaryLine[] {
  return value ? [{ label, value }] : []
}

function isReplaceableList(kind: number): boolean {
  return (
    kind >= NOSTR_REPLACEABLE_LIST_KIND_MIN &&
    kind <= NOSTR_REPLACEABLE_LIST_KIND_MAX
  )
}

function isHighRiskKind(kind: number): boolean {
  return NOSTR_SIGN_HIGH_RISK_KINDS.includes(kind) || isReplaceableList(kind)
}

function normalizeCertHash(hash: string): string {
  return hash.replaceAll(':', '').toLowerCase()
}

function isSatsignerPackage(packageId: string | undefined): boolean {
  return packageId === PACKAGE_ID_PROD || packageId === PACKAGE_ID_DEV
}

/** Our package signed with another certificate: either a rotation or an attack. */
function getAssetWarning(event: EventTemplate): string | undefined {
  const packageId = tagValue(event.tags, 'i')
  const certHash = tagValue(event.tags, NOSTR_ZAPSTORE_CERT_HASH_TAG)
  if (!isSatsignerPackage(packageId) || certHash === undefined) {
    return undefined
  }
  return normalizeCertHash(certHash) === SATSIGNER_RELEASE_CERT_SHA256
    ? undefined
    : t('nip46.summary.unknownCertificate')
}

function summarizeZapstore(event: EventTemplate): Nip46EventSummary | null {
  const { kind, tags } = event
  if (kind === NOSTR_ZAPSTORE_APP_KIND) {
    return {
      lines: [
        ...line(t('nip46.summary.appId'), tagValue(tags, 'd')),
        ...line(t('nip46.summary.name'), tagValue(tags, 'name'))
      ],
      risk: 'normal',
      title: t('nip46.summary.zapstoreApp')
    }
  }
  if (kind === NOSTR_ZAPSTORE_RELEASE_KIND) {
    return {
      lines: [
        ...line(t('nip46.summary.appId'), tagValue(tags, 'i')),
        ...line(t('nip46.summary.version'), tagValue(tags, 'version')),
        ...line(t('nip46.summary.channel'), tagValue(tags, 'c')),
        ...line(t('nip46.summary.assets'), tagValues(tags, 'e').join(', '))
      ],
      risk: 'normal',
      title: t('nip46.summary.zapstoreRelease')
    }
  }
  if (kind === NOSTR_ZAPSTORE_ASSET_KIND) {
    return {
      lines: [
        ...line(t('nip46.summary.appId'), tagValue(tags, 'i')),
        ...line(t('nip46.summary.version'), tagValue(tags, 'version')),
        ...line(t('nip46.summary.fileHash'), tagValue(tags, 'x')),
        ...line(t('nip46.summary.size'), tagValue(tags, 'size')),
        ...line(
          t('nip46.summary.certificate'),
          tagValue(tags, NOSTR_ZAPSTORE_CERT_HASH_TAG)
        )
      ],
      risk: 'normal',
      title: t('nip46.summary.zapstoreAsset'),
      warning: getAssetWarning(event)
    }
  }
  if (kind === NOSTR_BLOSSOM_AUTH_KIND) {
    const expiration = tagValue(tags, 'expiration')
    return {
      lines: [
        ...line(t('nip46.summary.action'), tagValue(tags, 't')),
        ...line(t('nip46.summary.fileHash'), tagValue(tags, 'x')),
        ...line(
          t('nip46.summary.expires'),
          expiration
            ? new Date(Number(expiration) * MS_PER_SECOND).toLocaleString()
            : undefined
        )
      ],
      risk: 'normal',
      title: t('nip46.summary.blossomAuth')
    }
  }
  return null
}

function summarizeIdentityKind(event: EventTemplate): Nip46EventSummary | null {
  const { kind, tags } = event
  if (kind === nostrKinds.Metadata) {
    return {
      lines: [{ label: t('nip46.summary.profile'), value: event.content }],
      risk: 'high',
      title: t('nip46.summary.profileTitle'),
      warning: t('nip46.summary.profileWarning')
    }
  }
  if (kind === nostrKinds.Contacts) {
    return {
      lines: [
        {
          label: t('nip46.summary.follows'),
          value: String(tagValues(tags, 'p').length)
        }
      ],
      risk: 'high',
      title: t('nip46.summary.followsTitle'),
      warning: t('nip46.summary.followsWarning')
    }
  }
  if (kind === nostrKinds.EventDeletion) {
    return {
      lines: [
        ...line(t('nip46.summary.deletes'), tagValues(tags, 'e').join(', ')),
        ...line(
          t('nip46.summary.deletesAddress'),
          tagValues(tags, 'a').join(', ')
        )
      ],
      risk: 'high',
      title: t('nip46.summary.deletionTitle'),
      warning: t('nip46.summary.deletionWarning')
    }
  }
  return null
}

function summarizeEvent(event: EventTemplate): Nip46EventSummary {
  const known = summarizeZapstore(event) ?? summarizeIdentityKind(event)
  if (known) {
    return known
  }
  const highRisk = isHighRiskKind(event.kind)
  return {
    lines: [],
    risk: highRisk ? 'high' : 'normal',
    title: t('nip46.summary.kindTitle', { kind: event.kind }),
    warning: highRisk ? t('nip46.summary.listWarning') : undefined
  }
}

const DECRYPT_METHODS = new Set<Nip46Method>(['nip04_decrypt', 'nip44_decrypt'])

function withEventDate(
  summary: Nip46EventSummary,
  createdAt: number
): Nip46EventSummary {
  return {
    ...summary,
    lines: [
      ...summary.lines,
      {
        label: t('nip46.summary.date'),
        value: new Date(createdAt * MS_PER_SECOND).toLocaleString()
      }
    ]
  }
}

function summarizeSignRequest(request: NostrSignRequest): Nip46EventSummary {
  if (request.method === 'sign_event') {
    const event = getSignRequestEvent(request)
    return event
      ? withEventDate(summarizeEvent(event), event.created_at)
      : { lines: [], risk: 'high', title: t('nip46.summary.invalidEvent') }
  }
  const [counterparty] = request.params
  if (DECRYPT_METHODS.has(request.method)) {
    return {
      lines: line(t('nip46.approval.counterparty'), counterparty),
      risk: 'high',
      title: t('nip46.approval.decrypt'),
      warning: t('nip46.summary.decryptWarning')
    }
  }
  return {
    lines: line(t('nip46.approval.counterparty'), counterparty),
    risk: 'normal',
    title: request.method
  }
}

/** The batch is as risky as its riskiest request. */
function isHighRiskBatch(summaries: Nip46EventSummary[]): boolean {
  return summaries.some(
    (summary) => summary.risk === 'high' || summary.warning !== undefined
  )
}

type SignBatchState = 'answered' | 'decided' | 'expired' | 'invalid' | 'pending'

/**
 * Where a batch stands: pending until decided, decided until its answer
 * reached a relay, then answered. A batch of only unsignable requests is
 * invalid (it can still be declined, which answers with the reasons).
 */
function getSignBatchState(
  batch: NostrSignRequest[],
  nowSeconds: number
): SignBatchState {
  if (batch.some((request) => request.status === 'pending')) {
    return batch.some((request) => request.expiresAt <= nowSeconds)
      ? 'expired'
      : 'pending'
  }
  if (batch.every((request) => request.status === 'expired')) {
    return 'expired'
  }
  if (batch.every((request) => request.answered)) {
    return 'answered'
  }
  return batch.every((request) => request.status === 'invalid')
    ? 'invalid'
    : 'decided'
}

type SignBatchView = {
  highRisk: boolean
  items: { request: NostrSignRequest; summary: Nip46EventSummary }[]
  label?: string
  state: SignBatchState
}

function buildSignBatchView(
  batch: NostrSignRequest[],
  nowSeconds: number
): SignBatchView {
  const items = batch.map((request) => ({
    request,
    summary: summarizeSignRequest(request)
  }))
  return {
    highRisk: isHighRiskBatch(items.map((item) => item.summary)),
    items,
    label: batch.find((request) => request.label)?.label,
    state: getSignBatchState(batch, nowSeconds)
  }
}

export {
  buildSignBatchView,
  getSignBatchState,
  isHighRiskBatch,
  isHighRiskKind,
  normalizeCertHash,
  summarizeEvent,
  summarizeSignRequest
}
export type { Nip46EventSummary, SignBatchState, SignBatchView, SummaryLine }
