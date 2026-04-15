import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { SSIconNostr } from '@/components/icons'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSIconButton from '@/components/SSIconButton'
import SSNFCModal from '@/components/SSNFCModal'
import SSNostrHeroCard from '@/components/SSNostrHeroCard'
import SSNostrNoteTemplate from '@/components/SSNostrNoteTemplate'
import SSPaste from '@/components/SSPaste'
import SSPaymentMethodPicker, {
  type PaymentMethod
} from '@/components/SSPaymentMethodPicker'
import SSText from '@/components/SSText'
import { useContentHandler } from '@/hooks/useContentHandler'
import { useEcash } from '@/hooks/useEcash'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useLightningStore } from '@/store/lightning'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import {
  type DecodedNostrContent,
  decodeNostrContent
} from '@/utils/nostrIdentity'

type AccountParams = {
  npub: string
}

export default function NostrAccountLanding() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<AccountParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const relays = useNostrIdentityStore((state) => state.relays)
  const updateIdentity = useNostrIdentityStore(
    (state) => state.updateIdentity
  )
  const fetchedRef = useRef(false)

  useEffect(() => {
    const effectiveRelays = identity?.relays ?? relays
    if (!identity || !npub || fetchedRef.current || effectiveRelays.length === 0)
      return
    fetchedRef.current = true

    const api = new NostrAPI(effectiveRelays)
    api.fetchKind0(npub).then((profile) => {
      if (!profile) return
      updateIdentity(npub, {
        displayName: profile.displayName || identity.displayName,
        picture: profile.picture || identity.picture,
        nip05: profile.nip05 || identity.nip05,
        lud16: profile.lud16 || identity.lud16
      })
    }).catch(() => {
      fetchedRef.current = false
    })
  }, [npub, identity, relays, updateIdentity])

  const [scannedContent, setScannedContent] =
    useState<DecodedNostrContent | null>(null)
  const [paymentPickerVisible, setPaymentPickerVisible] = useState(false)
  const [payAmount, setPayAmount] = useState(0)

  const lightningConfig = useLightningStore((state) => state.config)
  const { mints } = useEcash()

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

  const handleContentScanned = useCallback(
    (detected: { type: string; raw: string; cleaned: string }) => {
      const decoded = decodeNostrContent(detected.cleaned || detected.raw)

      if (decoded.kind === 'note' || decoded.kind === 'nevent') {
        setScannedContent({ ...decoded, isLoading: true })

        const effectiveRelays = identity?.relays ?? relays
        const relayHints =
          decoded.kind === 'nevent' &&
          Array.isArray(decoded.metadata?.relays)
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
              setScannedContent({ ...decoded, isLoading: false })
              toast.error(t('nostrIdentity.account.eventNotFound'))
              return
            }

            const fetchedData = {
              content: event.content,
              created_at: event.created_at,
              kind: event.kind,
              pubkey: event.pubkey,
              tags: event.tags
            }

            setScannedContent({
              ...decoded,
              fetched: fetchedData,
              isLoading: false,
              metadata: {
                ...decoded.metadata,
                content: event.content,
                kind: event.kind,
                tags: event.tags
              }
            })

            const authorNpub = nip19.npubEncode(event.pubkey)
            api
              .fetchKind0(authorNpub)
              .then((profile) => {
                if (!profile) return
                setScannedContent((prev) => {
                  if (!prev?.fetched) return prev
                  return {
                    ...prev,
                    fetched: {
                      ...prev.fetched,
                      authorName: profile.displayName,
                      authorPicture: profile.picture
                    }
                  }
                })
              })
              .catch(() => {})
          })
          .catch(() => {
            setScannedContent({ ...decoded, isLoading: false })
          })
      } else {
        setScannedContent(decoded)
      }
    },
    [identity, relays]
  )

  const contentHandler = useContentHandler({
    context: 'nostr',
    onContentScanned: handleContentScanned,
    onSend: () => {},
    onReceive: () => {}
  })

  function handlePay(amountSats: number) {
    if (availablePaymentMethods.length === 0) {
      return
    }
    if (availablePaymentMethods.length === 1) {
      navigateToPayment(availablePaymentMethods[0], amountSats)
      return
    }
    setPayAmount(amountSats)
    setPaymentPickerVisible(true)
  }

  function navigateToPayment(method: PaymentMethod, amountSats: number) {
    setPaymentPickerVisible(false)
    if (method.type === 'lightning') {
      router.navigate('/signer/lightning')
    } else if (method.type === 'ecash') {
      router.navigate('/signer/ecash')
    }
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: () => (
            <SSIconButton
              onPress={() =>
                router.navigate({
                  pathname: '/signer/nostr/account/[npub]/settings',
                  params: { npub }
                })
              }
              style={{ marginRight: 8 }}
            >
              <SSIconNostr height={16} width={16} />
            </SSIconButton>
          ),
          headerTitle: () => (
            <SSText uppercase>
              {identity.displayName || t('nostrIdentity.title')}
            </SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="md">
          <SSNostrHeroCard identity={identity} />

          <SSButtonActionsGroup
            context="nostr"
            nfcAvailable={contentHandler.nfcAvailable}
            onSend={contentHandler.handleSend}
            onPaste={contentHandler.handlePaste}
            onCamera={contentHandler.handleCamera}
            onNFC={contentHandler.handleNFC}
            onReceive={contentHandler.handleReceive}
          />

          {scannedContent && scannedContent.kind !== 'unknown' && (
            <SSNostrNoteTemplate
              content={scannedContent}
              onPay={handlePay}
            />
          )}
        </SSVStack>
      </ScrollView>

      <SSCameraModal
        visible={contentHandler.cameraModalVisible}
        onClose={contentHandler.closeCameraModal}
        onContentScanned={contentHandler.handleContentScanned}
        context="nostr"
        title={t('nostrIdentity.account.scanTitle')}
      />
      <SSNFCModal
        visible={contentHandler.nfcModalVisible}
        onClose={contentHandler.closeNFCModal}
        onContentRead={contentHandler.handleNFCContentRead}
        mode="read"
      />
      <SSPaste
        visible={contentHandler.pasteModalVisible}
        onClose={contentHandler.closePasteModal}
        onContentPasted={contentHandler.handleContentPasted}
        context="nostr"
      />
      <SSPaymentMethodPicker
        visible={paymentPickerVisible}
        onClose={() => setPaymentPickerVisible(false)}
        onSelect={(method) => navigateToPayment(method, payAmount)}
        methods={availablePaymentMethods}
        amountSats={payAmount}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: 60
  }
})
