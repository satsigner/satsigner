import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors } from '@/styles'
import {
  type FetchedNoteData,
  decodeNostrContent,
  extractEnhancedZapTags,
  extractPubpayTags,
  truncateNpub
} from '@/utils/nostrIdentity'
import {
  type ZapReceiptInfo,
  enrichZapReceipts,
  fetchZapReceipts,
  initiateZap
} from '@/utils/zap'

type NoteParams = {
  npub: string
  nostrUri: string
}

const ZAP_PRESETS = [21, 100, 500, 1000]

export default function NostrNotePage() {
  const router = useRouter()
  const { npub, nostrUri } = useLocalSearchParams<NoteParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const effectiveRelays = identity?.relays ?? globalRelays

  const [fetched, setFetched] = useState<FetchedNoteData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const [customAmount, setCustomAmount] = useState('')
  const [zapLoading, setZapLoading] = useState(false)
  const [zapReceipts, setZapReceipts] = useState<ZapReceiptInfo[]>([])
  const fetchedRef = useRef(false)
  const pendingInvoiceRef = useRef<{ invoice: string; zapRequestJson: string } | null>(null)

  const lightningConfig = useLightningStore((state) => state.config)
  const { mints } = useEcash()

  const pendingZap = useZapFlowStore((state) => state.pendingZap)
  const zapResult = useZapFlowStore((state) => state.zapResult)
  const clearPendingZap = useZapFlowStore((state) => state.clearPendingZap)
  const setZapResult = useZapFlowStore((state) => state.setZapResult)

  const decoded = useMemo(() => {
    if (!nostrUri) return null
    return decodeNostrContent(nostrUri)
  }, [nostrUri])

  const availablePaymentMethods = useMemo(() => {
    const methods: PaymentMethod[] = []
    if (lightningConfig) {
      methods.push({
        id: 'lightning',
        label: 'Lightning',
        type: 'lightning',
        detail: lightningConfig.url
      })
    }
    if (mints.length > 0) {
      for (const mint of mints) {
        methods.push({
          id: `ecash-${mint.url}`,
          label: 'ECash',
          type: 'ecash',
          detail: mint.name || mint.url
        })
      }
    }
    return methods
  }, [lightningConfig, mints])

  useEffect(() => {
    if (!decoded || fetchedRef.current) return
    if (
      decoded.kind !== 'note' &&
      decoded.kind !== 'nevent' &&
      decoded.kind !== 'json_note'
    )
      return

    fetchedRef.current = true

    if (decoded.kind === 'json_note' && decoded.metadata) {
      setFetched({
        content:
          typeof decoded.metadata.content === 'string'
            ? decoded.metadata.content
            : '',
        created_at: 0,
        kind:
          typeof decoded.metadata.kind === 'number'
            ? decoded.metadata.kind
            : 1,
        pubkey: '',
        tags: Array.isArray(decoded.metadata.tags)
          ? (decoded.metadata.tags as string[][])
          : []
      })
      setIsLoading(false)
      setProfileLoading(false)
      return
    }

    const relayHints =
      decoded.kind === 'nevent' && Array.isArray(decoded.metadata?.relays)
        ? (decoded.metadata.relays as string[])
        : undefined
    const allRelays = relayHints?.length
      ? [...new Set([...relayHints, ...effectiveRelays])]
      : effectiveRelays

    const api = new NostrAPI(allRelays)
    api
      .fetchEvent(decoded.data, relayHints)
      .then((event) => {
        if (!event) {
          setIsLoading(false)
          setProfileLoading(false)
          toast.error(t('nostrIdentity.account.eventNotFound'))
          return
        }

        setFetched({
          content: event.content,
          created_at: event.created_at,
          kind: event.kind,
          pubkey: event.pubkey,
          tags: event.tags
        })
        setIsLoading(false)

        loadZapReceipts(decoded.data)

        const authorNpub = nip19.npubEncode(event.pubkey)
        const profileApi = new NostrAPI([
          ...allRelays,
          'wss://relay.nostr.band',
          'wss://relay.primal.net',
          'wss://purplepag.es'
        ])
        profileApi
          .fetchKind0(authorNpub)
          .then((profile) => {
            if (!profile) {
              setProfileLoading(false)
              return
            }
            setFetched((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                authorName: profile.displayName,
                authorPicture: profile.picture,
                authorLud16: profile.lud16
              }
            })
            setProfileLoading(false)
          })
          .catch(() => {
            setProfileLoading(false)
          })
      })
      .catch(() => {
        setIsLoading(false)
        setProfileLoading(false)
        toast.error(t('nostrIdentity.account.eventNotFound'))
      })
  }, [decoded, effectiveRelays]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (zapResult === 'success' && pendingZap) {
      toast.success(
        `${t('nostrIdentity.note.zapSuccess')} (${pendingZap.amountSats} sats)`
      )
      if (decoded?.data) {
        loadZapReceipts(decoded.data)
      }
      clearPendingZap()
      setZapResult(null)
    } else if (zapResult === 'cancelled') {
      clearPendingZap()
      setZapResult(null)
    }
  }, [zapResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadZapReceipts = useCallback(
    async (eventIdHex: string) => {
      try {
        const receipts = await fetchZapReceipts(eventIdHex, effectiveRelays)
        setZapReceipts(receipts)
        await enrichZapReceipts(receipts, effectiveRelays)
        setZapReceipts([...receipts])
      } catch {
        // non-critical
      }
    },
    [effectiveRelays]
  )

  const pubpayTags = useMemo(
    () => extractPubpayTags(fetched?.tags ?? []),
    [fetched]
  )

  const enhancedZap = useMemo(
    () => extractEnhancedZapTags(fetched?.tags ?? []),
    [fetched]
  )

  const isFixedAmount =
    enhancedZap.zapMin !== undefined &&
    enhancedZap.zapMax !== undefined &&
    enhancedZap.zapMin === enhancedZap.zapMax

  const isRangeAmount =
    enhancedZap.zapMin !== undefined &&
    enhancedZap.zapMax !== undefined &&
    enhancedZap.zapMin < enhancedZap.zapMax

  const hasEnhancedZapTags =
    enhancedZap.zapMin !== undefined || enhancedZap.zapMax !== undefined

  const effectiveLud16 = enhancedZap.zapLnurl || fetched?.authorLud16

  const totalZapped = useMemo(
    () => zapReceipts.reduce((sum, r) => sum + r.amountSats, 0),
    [zapReceipts]
  )

  const goalProgress =
    enhancedZap.zapGoal && enhancedZap.zapGoal > 0
      ? Math.min(totalZapped / enhancedZap.zapGoal, 1)
      : undefined

  const usesRemaining =
    enhancedZap.zapUses !== undefined
      ? Math.max(0, enhancedZap.zapUses - zapReceipts.length)
      : undefined

  const isRequestComplete =
    (goalProgress !== undefined && goalProgress >= 1) ||
    (usesRemaining !== undefined && usesRemaining <= 0)

  async function handleZap(amountSats: number) {
    if (!amountSats || amountSats <= 0) return
    if (availablePaymentMethods.length === 0) return

    if (!effectiveLud16) {
      toast.error(t('nostrIdentity.note.zapEndpointNotFound'))
      return
    }

    if (!identity?.nsec) {
      toast.error(t('nostrIdentity.error.missingKeys'))
      return
    }

    if (!fetched) return

    setZapLoading(true)
    try {
      const { invoice, zapRequestJson } = await initiateZap({
        recipientLud16: effectiveLud16,
        recipientPubkeyHex: fetched.pubkey,
        senderNsec: identity.nsec,
        eventIdHex: decoded?.data,
        eventKind: fetched.kind,
        eventTags: fetched.tags,
        amountSats,
        relays: effectiveRelays
      })

      setZapLoading(false)
      pendingInvoiceRef.current = { invoice, zapRequestJson }

      if (availablePaymentMethods.length === 1) {
        navigateToPayment(availablePaymentMethods[0], invoice, zapRequestJson, amountSats)
        return
      }

      setPayAmount(amountSats)
      setPaymentPickerVisible(true)
    } catch (err) {
      setZapLoading(false)
      const message =
        err instanceof Error ? err.message : t('nostrIdentity.note.zapFailed')
      toast.error(message)
    }
  }

  function navigateToPayment(
    method: PaymentMethod,
    invoice?: string,
    zapRequestJson?: string,
    amountSats?: number
  ) {
    setPaymentPickerVisible(false)

    const pending = pendingInvoiceRef.current
    const bolt11 = invoice || pending?.invoice
    const reqJson = zapRequestJson || pending?.zapRequestJson || ''
    const sats = amountSats ?? payAmount
    pendingInvoiceRef.current = null

    if (bolt11 && npub && nostrUri) {
      useZapFlowStore.getState().setPendingZap({
        noteNpub: npub,
        nostrUri,
        invoice: bolt11,
        amountSats: sats,
        zapRequestJson: reqJson,
        paymentMethod: method
      })
    }

    if (method.type === 'lightning') {
      router.navigate({
        pathname: '/signer/lightning/pay',
        params: bolt11 ? { invoice: bolt11 } : undefined
      })
    } else if (method.type === 'ecash') {
      router.navigate({
        pathname: '/signer/ecash/send',
        params: bolt11 ? { invoice: bolt11 } : undefined
      })
    } else if (method.type === 'ark') {
      toast.info(t('nostrIdentity.note.arkComingSoon'))
    }
  }

  function handleAmountSelected(sats: number) {
    setCustomAmount('')
    handleZap(sats)
  }

  function handleCustomAmountSubmit() {
    const sats = parseInt(customAmount, 10)
    if (!sats || sats <= 0) return
    handleZap(sats)
  }

  function formatTimestamp(ts: number): string {
    if (!ts) return ''
    return new Date(ts * 1000).toLocaleString()
  }

  if (!decoded || decoded.kind === 'unknown') {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('nostrIdentity.note.title')}</SSText>
            )
          }}
        />
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
          <SSText color="muted">
            {t('nostrIdentity.note.invalidContent')}
          </SSText>
          <SSButton
            label={t('common.back')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.note.title')}</SSText>
          )
        }}
      />

      {isLoading ? (
        <SSVStack itemsCenter gap="md" style={styles.centered}>
          <ActivityIndicator color={Colors.white} size="large" />
          <SSText color="muted">
            {t('nostrIdentity.account.fetchingNote')}
          </SSText>
        </SSVStack>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SSVStack gap="lg" style={styles.content}>
            {fetched?.pubkey && (
              <SSHStack gap="md" style={styles.authorRow}>
                {fetched.authorPicture ? (
                  <Image
                    source={{ uri: fetched.authorPicture }}
                    style={styles.authorAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.authorAvatar,
                      styles.authorAvatarPlaceholder
                    ]}
                  >
                    <SSText size="lg" weight="bold">
                      {fetched.authorName?.[0]?.toUpperCase() || '?'}
                    </SSText>
                  </View>
                )}
                <SSVStack gap="none" style={{ flex: 1 }}>
                  {fetched.authorName && (
                    <SSText size="md" weight="medium">
                      {fetched.authorName}
                    </SSText>
                  )}
                  <SSText size="xs" color="muted" type="mono">
                    {truncateNpub(
                      nip19.npubEncode(fetched.pubkey),
                      12
                    )}
                  </SSText>
                </SSVStack>
              </SSHStack>
            )}

            <SSHStack gap="sm">
              {fetched && (
                <View style={styles.kindBadge}>
                  <SSText size="xs">Kind {fetched.kind}</SSText>
                </View>
              )}
              {fetched && fetched.created_at > 0 && (
                <SSText size="xs" color="muted">
                  {formatTimestamp(fetched.created_at)}
                </SSText>
              )}
            </SSHStack>

            {fetched && fetched.content.length > 0 && (
              <View style={styles.noteCard}>
                <SSText style={styles.noteText}>
                  {fetched.content}
                </SSText>
              </View>
            )}

            <SSVStack gap="xs">
              <SSText size="xs" color="muted" uppercase>
                {t('nostrIdentity.note.noteId')}
              </SSText>
              <SSClipboardCopy text={nostrUri || decoded.raw}>
                <SSText size="xs" type="mono" color="muted">
                  {truncateNpub(decoded.raw, 16)}
                </SSText>
              </SSClipboardCopy>
            </SSVStack>

            {fetched && availablePaymentMethods.length > 0 && (
              <SSVStack gap="sm">
                {profileLoading ? (
                  <SSHStack gap="sm" style={styles.zapLoadingRow}>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <SSText size="xs" color="muted">
                      {t('nostrIdentity.note.loadingProfile')}
                    </SSText>
                  </SSHStack>
                ) : (
                  <>
                    {isRequestComplete && (
                      <View style={styles.completeBadge}>
                        <SSText size="sm" weight="bold" center>
                          {t('nostrIdentity.note.requestComplete')}
                        </SSText>
                      </View>
                    )}

                    {enhancedZap.zapGoal !== undefined && (
                      <SSVStack gap="xs">
                        <SSHStack
                          gap="sm"
                          style={styles.goalHeader}
                        >
                          <SSText size="xs" color="muted">
                            {t('nostrIdentity.note.goal')}
                          </SSText>
                          <SSText size="xs" weight="medium">
                            {totalZapped.toLocaleString()} / {enhancedZap.zapGoal.toLocaleString()} sats
                          </SSText>
                        </SSHStack>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${(goalProgress ?? 0) * 100}%` }
                            ]}
                          />
                        </View>
                      </SSVStack>
                    )}

                    {enhancedZap.zapUses !== undefined && (
                      <SSHStack gap="sm" style={styles.goalHeader}>
                        <SSText size="xs" color="muted">
                          {t('nostrIdentity.note.uses')}
                        </SSText>
                        <SSText size="xs" weight="medium">
                          {zapReceipts.length} / {enhancedZap.zapUses}
                        </SSText>
                      </SSHStack>
                    )}

                    {enhancedZap.zapLnurl && (
                      <SSHStack gap="sm" style={styles.goalHeader}>
                        <SSText size="xs" color="muted">
                          {t('nostrIdentity.note.payTo')}
                        </SSText>
                        <SSText size="xs" type="mono">
                          {enhancedZap.zapLnurl}
                        </SSText>
                      </SSHStack>
                    )}

                    {isFixedAmount && !isRequestComplete && (
                      <SSButton
                        label={`${t('nostrIdentity.note.zap')} ${enhancedZap.zapMin} sats`}
                        variant="gradient"
                        gradientType="special"
                        disabled={zapLoading || !effectiveLud16}
                        onPress={() =>
                          handleAmountSelected(enhancedZap.zapMin!)
                        }
                      />
                    )}

                    {isRangeAmount && !isRequestComplete && (
                      <SSVStack gap="sm">
                        <SSText size="xs" color="muted">
                          {t('nostrIdentity.note.rangeHint', {
                            min: enhancedZap.zapMin!.toLocaleString(),
                            max: enhancedZap.zapMax!.toLocaleString()
                          })}
                        </SSText>
                        <SSHStack gap="sm" style={styles.presetRow}>
                          {[
                            enhancedZap.zapMin!,
                            Math.round(
                              (enhancedZap.zapMin! + enhancedZap.zapMax!) / 2
                            ),
                            enhancedZap.zapMax!
                          ].map((sats) => (
                            <TouchableOpacity
                              key={sats}
                              style={styles.presetButton}
                              disabled={zapLoading || !effectiveLud16}
                              onPress={() => handleAmountSelected(sats)}
                              activeOpacity={0.6}
                            >
                              <SSText size="sm" weight="medium" center>
                                {sats.toLocaleString()}
                              </SSText>
                            </TouchableOpacity>
                          ))}
                        </SSHStack>
                        <TextInput
                          style={styles.customInput}
                          placeholderTextColor={Colors.gray[500]}
                          placeholder={`${enhancedZap.zapMin} – ${enhancedZap.zapMax} sats`}
                          keyboardType="number-pad"
                          value={customAmount}
                          onChangeText={setCustomAmount}
                          returnKeyType="done"
                          editable={!!effectiveLud16}
                          onSubmitEditing={handleCustomAmountSubmit}
                        />
                        <SSButton
                          label={
                            customAmount && parseInt(customAmount, 10) > 0
                              ? `${t('nostrIdentity.note.zap')} ${customAmount} sats`
                              : t('nostrIdentity.note.zap')
                          }
                          variant="gradient"
                          gradientType="special"
                          disabled={
                            zapLoading ||
                            !effectiveLud16 ||
                            !customAmount ||
                            parseInt(customAmount, 10) < (enhancedZap.zapMin ?? 1) ||
                            parseInt(customAmount, 10) > (enhancedZap.zapMax ?? Infinity)
                          }
                          onPress={handleCustomAmountSubmit}
                        />
                      </SSVStack>
                    )}

                    {pubpayTags.length > 0 && !hasEnhancedZapTags && (
                      <SSVStack gap="sm">
                        <SSText size="xs" color="muted" uppercase>
                          {t('nostrIdentity.note.zapAmounts')}
                        </SSText>
                        {pubpayTags.map((tag, index) => (
                          <SSHStack key={index} gap="sm" style={styles.zapRow}>
                            <SSVStack gap="none" style={{ flex: 1 }}>
                              <SSText size="lg" weight="medium">
                                {tag.amount} {tag.currency}
                              </SSText>
                              {tag.relay && (
                                <SSText size="xs" color="muted">
                                  via {tag.relay}
                                </SSText>
                              )}
                            </SSVStack>
                            <SSButton
                              label={t('nostrIdentity.note.zap')}
                              variant="gradient"
                              gradientType="special"
                              disabled={
                                zapLoading || !effectiveLud16
                              }
                              onPress={() =>
                                handleAmountSelected(tag.amount)
                              }
                              style={styles.zapButton}
                            />
                          </SSHStack>
                        ))}
                      </SSVStack>
                    )}

                    {!isRequestComplete && (
                      <SSVStack gap="sm">
                        <SSText size="xs" color="muted" uppercase>
                          {hasEnhancedZapTags && !isRangeAmount
                            ? t('nostrIdentity.note.customZap')
                            : !hasEnhancedZapTags
                              ? t('nostrIdentity.note.zapAmount')
                              : ''}
                        </SSText>

                        {!hasEnhancedZapTags && (
                          <SSHStack gap="sm" style={styles.presetRow}>
                            {ZAP_PRESETS.map((sats) => (
                              <TouchableOpacity
                                key={sats}
                                style={styles.presetButton}
                                disabled={
                                  zapLoading || !effectiveLud16
                                }
                                onPress={() =>
                                  handleAmountSelected(sats)
                                }
                                activeOpacity={0.6}
                              >
                                <SSText size="sm" weight="medium" center>
                                  {sats}
                                </SSText>
                              </TouchableOpacity>
                            ))}
                          </SSHStack>
                        )}

                        {!isRangeAmount && (
                          <>
                            <TextInput
                              style={styles.customInput}
                              placeholderTextColor={Colors.gray[500]}
                              placeholder={t(
                                'nostrIdentity.note.customAmount'
                              )}
                              keyboardType="number-pad"
                              value={customAmount}
                              onChangeText={setCustomAmount}
                              returnKeyType="done"
                              editable={!!effectiveLud16}
                              onSubmitEditing={handleCustomAmountSubmit}
                            />
                            <SSButton
                              label={
                                customAmount &&
                                parseInt(customAmount, 10) > 0
                                  ? `${t('nostrIdentity.note.zap')} ${customAmount} sats`
                                  : t('nostrIdentity.note.zap')
                              }
                              variant="gradient"
                              gradientType="special"
                              disabled={
                                zapLoading ||
                                !effectiveLud16 ||
                                !customAmount ||
                                parseInt(customAmount, 10) <= 0
                              }
                              onPress={handleCustomAmountSubmit}
                            />
                          </>
                        )}

                        {!effectiveLud16 && (
                          <SSText size="xs" color="muted" center>
                            {t('nostrIdentity.note.zapEndpointNotFound')}
                          </SSText>
                        )}
                      </SSVStack>
                    )}
                  </>
                )}

                {zapLoading && (
                  <SSHStack gap="sm" style={styles.zapLoadingRow}>
                    <ActivityIndicator color={Colors.white} size="small" />
                    <SSText size="sm" color="muted">
                      {t('nostrIdentity.note.zapSending')}
                    </SSText>
                  </SSHStack>
                )}
              </SSVStack>
            )}

            {identity?.isWatchOnly && fetched && (
              <SSText size="xs" color="muted" center>
                {t('nostrIdentity.keys.watchOnly')}
              </SSText>
            )}

            {zapReceipts.length > 0 && (
              <SSVStack gap="sm">
                <SSText size="xs" color="muted" uppercase>
                  {t('nostrIdentity.note.zapReceipts')} ({zapReceipts.length})
                </SSText>
                {zapReceipts.map((receipt, idx) => (
                  <SSHStack key={idx} gap="sm" style={styles.receiptRow}>
                    {receipt.senderPicture ? (
                      <Image
                        source={{ uri: receipt.senderPicture }}
                        style={styles.receiptAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.receiptAvatar,
                          styles.receiptAvatarPlaceholder
                        ]}
                      >
                        <SSText size="xs" weight="bold">
                          {receipt.senderName?.[0]?.toUpperCase() || '?'}
                        </SSText>
                      </View>
                    )}
                    <SSVStack gap="none" style={{ flex: 1 }}>
                      <SSText size="sm" weight="medium">
                        {receipt.senderName ||
                          truncateNpub(
                            nip19.npubEncode(receipt.senderPubkey),
                            8
                          )}
                      </SSText>
                      {receipt.comment ? (
                        <SSText size="xs" color="muted">
                          {receipt.comment}
                        </SSText>
                      ) : null}
                    </SSVStack>
                    <SSVStack gap="none" style={styles.receiptAmountCol}>
                      <SSText size="sm" weight="bold" color="white">
                        {receipt.amountSats} sats
                      </SSText>
                      {receipt.createdAt > 0 && (
                        <SSText size="xxs" color="muted">
                          {formatTimestamp(receipt.createdAt)}
                        </SSText>
                      )}
                    </SSVStack>
                  </SSHStack>
                ))}
              </SSVStack>
            )}

            {zapReceipts.length === 0 && fetched && (
              <SSText size="xs" color="muted" center>
                {t('nostrIdentity.note.noZapsYet')}
              </SSText>
            )}

            {!fetched && !isLoading && (
              <SSVStack itemsCenter gap="md" style={styles.notFoundCard}>
                <SSText color="muted">
                  {t('nostrIdentity.account.eventNotFound')}
                </SSText>
                <SSText size="xs" type="mono" color="muted">
                  {truncateNpub(decoded.raw, 16)}
                </SSText>
              </SSVStack>
            )}
          </SSVStack>
        </ScrollView>
      )}

      <SSPaymentMethodPicker
        visible={paymentPickerVisible}
        onClose={() => setPaymentPickerVisible(false)}
        onSelect={(method) => navigateToPayment(method)}
        methods={availablePaymentMethods}
        amountSats={payAmount}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  authorAvatar: {
    borderRadius: 24,
    height: 48,
    width: 48
  },
  authorAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  authorRow: {
    alignItems: 'center'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60
  },
  completeBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  content: {
    paddingBottom: 40
  },
  customInput: {
    backgroundColor: '#242424',
    borderRadius: 3,
    color: Colors.white,
    fontSize: 16,
    padding: 12
  },
  goalHeader: {
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  kindBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  noteCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 16
  },
  noteText: {
    color: Colors.white,
    fontSize: 15,
    lineHeight: 22
  },
  notFoundCard: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 5,
    borderWidth: 1,
    padding: 24
  },
  presetButton: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10
  },
  presetRow: {
    justifyContent: 'space-between'
  },
  progressFill: {
    backgroundColor: Colors.white,
    borderRadius: 2,
    height: '100%'
  },
  progressTrack: {
    backgroundColor: Colors.gray[800],
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    width: '100%'
  },
  receiptAmountCol: {
    alignItems: 'flex-end'
  },
  receiptAvatar: {
    borderRadius: 16,
    height: 32,
    width: 32
  },
  receiptAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  receiptRow: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  zapButton: {
    minWidth: 90
  },
  zapLoadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8
  },
  zapRow: {
    alignItems: 'center',
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    padding: 14
  }
})
