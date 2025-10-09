import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { Colors } from '@/styles'
import type { NostrDM } from '@/types/models/Nostr'
import { type Transaction } from '@/types/models/Transaction'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import {
  handleGoToSignFlow,
  parseNostrTransactionMessage
} from '@/utils/nostrTransactionParser'
import {
  findMatchingAccount,
  type TransactionData
} from '@/utils/psbtAccountMatcher'
import {
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT
} from '@/utils/psbtTransactionExtractor'
import { estimateTransactionSize } from '@/utils/transaction'

// Cache for npub colors
const colorCache = new Map<string, { text: string; color: string }>()

async function formatNpub(
  pubkey: string,
  members: { npub: string; color: string }[]
): Promise<{ text: string; color: string }> {
  if (!pubkey)
    return {
      text: t('account.nostrSync.devicesGroupChat.unknownSender'),
      color: '#666666'
    }

  const cached = colorCache.get(pubkey)
  if (cached) {
    return cached
  }

  try {
    const npub = nip19.npubEncode(pubkey)
    const member = members.find((m) => m.npub === npub)

    const color = member?.color || '#404040'
    const result = {
      text: `${npub.slice(0, 12)}...${npub.slice(-4)}`,
      color
    }
    colorCache.set(pubkey, result)
    return result
  } catch {
    return { text: pubkey.slice(0, 8), color: '#404040' }
  }
}

function SSDevicesGroupChat() {
  // Hooks
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const flatListRef = useRef<FlatList>(null)
  const formattedAuthorsRef = useRef(new Set<string>())
  const { sendDM } = useNostrSync()

  // Zustand stores
  const account = useAccountsStore((state) =>
    state.accounts.find((_account) => _account.id === accountId)
  )
  const members = useNostrStore(
    useShallow((state) => state.members?.[accountId] || [])
  )
  const [transactionToShare, setTransactionToShare] = useNostrStore(
    useShallow((state) => [
      state.transactionToShare,
      state.setTransactionToShare
    ])
  )

  // State
  const [isLoading, setIsLoading] = useState(false)
  const [isContentLoaded, setIsContentLoaded] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [messageInput, setMessageInput] = useState('')
  const [formattedNpubs, setFormattedNpubs] = useState<
    Map<string, { text: string; color: string }>
  >(new Map())
  const [visibleComponents, setVisibleComponents] = useState(
    new Map<string, { sankey: boolean; status: boolean }>()
  )
  const [isShareModalVisible, setIsShareModalVisible] = useState(false)
  const [messageToShare, setMessageToShare] = useState('')
  const [transactionDataForModal, setTransactionDataForModal] =
    useState<TransactionData | null>(null)

  // Memoized values
  const messages = useMemo(
    () => account?.nostr?.dms || [],
    [account?.nostr?.dms]
  )
  const memoizedMessages = useMemo(() => messages, [messages])
  const membersList = useMemo(
    () =>
      members.map((member) => ({
        npub: member.npub,
        color: member.color || '#404040'
      })),
    [members]
  )

  // Callbacks
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim()) {
      toast.error(t('common.error.messageCannotBeEmpty'))
      return
    }

    if (!account?.nostr?.autoSync) {
      toast.error(t('common.error.autoSyncMustBeEnabled'))
      return
    }

    if (
      !account?.nostr?.deviceNsec ||
      !account?.nostr?.deviceNpub ||
      !account?.nostr?.relays?.length
    ) {
      toast.error(t('common.error.missingRequiredNostrConfig'))
      return
    }

    setIsLoading(true)
    try {
      await sendDM(account, messageInput.trim())
      setMessageInput('')
    } catch {
      toast.error(t('common.error.failedToSendMessage'))
    } finally {
      setIsLoading(false)
    }
  }, [account, messageInput, sendDM])

  const handleGoToSignFlowClick = useCallback(
    (messageContent: string) => {
      try {
        if (!messageContent.includes('Transaction Data (PSBT-based):')) {
          toast.error(t('common.error.transactionDataInvalid'))
          return
        }

        const transactionData = parseNostrTransactionMessage(messageContent)
        if (!transactionData) {
          toast.error(t('common.error.transactionDataParseFailed'))
          return
        }

        handleGoToSignFlow(transactionData, router)
      } catch {
        toast.error(t('common.error.openSignFlowFailed'))
      }
    },
    [router]
  )

  const handleToggleVisibility = useCallback(
    (msgId: string, component: 'sankey' | 'status') => {
      setVisibleComponents((prev) => {
        const newMap = new Map(prev)
        const current = newMap.get(msgId) || {
          sankey: false,
          status: false
        }
        newMap.set(msgId, { ...current, [component]: true })
        return newMap
      })
    },
    []
  )

  const handleShareInChat = useCallback(async () => {
    if (!account || !messageToShare) return

    setIsLoading(true)
    try {
      await sendDM(account, messageToShare)
      toast.success(t('account.nostrSync.transactionDataSentToGroupChat'))
    } catch {
      toast.error(t('account.nostrSync.failedToSendTransactionData'))
    } finally {
      setIsShareModalVisible(false)
      setMessageToShare('')
      setTransactionDataForModal(null)
      setIsLoading(false)
    }
  }, [account, messageToShare, sendDM])

  const handleCancelShare = useCallback(() => {
    setIsShareModalVisible(false)
    setMessageToShare('')
    setTransactionDataForModal(null)
  }, [])

  // Effects
  useEffect(() => {
    const formatNpubs = async () => {
      const newFormattedNpubs = new Map()
      let hasNewAuthors = false

      for (const msg of memoizedMessages) {
        if (!formattedAuthorsRef.current.has(msg.author)) {
          const formatted = await formatNpub(msg.author, membersList)
          newFormattedNpubs.set(msg.author, formatted)
          formattedAuthorsRef.current.add(msg.author)
          hasNewAuthors = true
        }
      }

      // Only update state if we have new authors to format
      if (hasNewAuthors) {
        setFormattedNpubs((prev) => new Map([...prev, ...newFormattedNpubs]))
      }
    }

    formatNpubs()
  }, [memoizedMessages, membersList])

  useEffect(() => {
    if (messages.length > 0 && account?.nostr?.relays?.length) {
      if (isInitialLoad) {
        setIsContentLoaded(false)
        // Wait for content to be fully rendered
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: false })
            // Double check scroll after a short delay
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false })
              setIsContentLoaded(true)
              setIsInitialLoad(false)
            }, 200)
          }
        }, 100)
      } else {
        // For subsequent updates, just scroll without showing loading
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: false })
        }
      }
    }
  }, [messages.length, account?.nostr?.relays?.length, isInitialLoad])

  useEffect(() => {
    if (transactionToShare) {
      setMessageToShare(transactionToShare.message)
      setTransactionDataForModal(transactionToShare.transactionData)
      setIsShareModalVisible(true)
      setTransactionToShare(null)
    }
  }, [transactionToShare, setTransactionToShare])

  const renderMessage = useCallback(
    ({ item: msg }: { item: NostrDM }) => {
      try {
        // Ensure we have a valid hex string
        const hexString = msg.author.startsWith('npub')
          ? msg.author
          : msg.author.padStart(64, '0').toLowerCase()

        // Only encode if it's not already an npub
        const msgAuthorNpub = msg.author.startsWith('npub')
          ? msg.author
          : nip19.npubEncode(hexString)

        const isDeviceMessage = msgAuthorNpub === account?.nostr?.deviceNpub
        const formatted = formattedNpubs.get(msg.author) || {
          text: `${msgAuthorNpub.slice(0, 12)}...${msgAuthorNpub.slice(-4)}`,
          color: '#404040'
        }

        // Get message content
        const messageContent =
          typeof msg.content === 'object' && 'description' in msg.content
            ? msg.content.description
            : typeof msg.content === 'string'
              ? msg.content
              : t('account.nostrSync.devicesGroupChat.displayError')

        // Check if message contains transaction data (PSBT)
        const hasSignFlow = messageContent.includes(
          'Transaction Data (PSBT-based):'
        )

        return (
          <SSVStack
            gap="xxs"
            style={[styles.message, isDeviceMessage && styles.deviceMessage]}
          >
            <SSHStack gap="xxs" justifyBetween>
              <SSHStack gap="xxs" style={{ alignItems: 'center' }}>
                <View
                  style={[
                    styles.authorIndicator,
                    { backgroundColor: formatted.color }
                  ]}
                />
                <SSText size="sm" color="muted">
                  {formatted.text}
                  {isDeviceMessage &&
                    t('account.nostrSync.devicesGroupChat.youSuffix')}
                </SSText>
              </SSHStack>
              <SSText size="xs" color="muted">
                {new Date(msg.created_at * 1000).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </SSText>
            </SSHStack>
            {hasSignFlow ? (
              (() => {
                const transactionData =
                  parseNostrTransactionMessage(messageContent)
                const transactionId = transactionData?.originalPsbt
                  ? extractTransactionIdFromPSBT(transactionData.originalPsbt)
                  : null

                if (transactionData && transactionId) {
                  const { keysRequired, keyCount, signedPsbts, originalPsbt } =
                    transactionData

                  const accounts = useAccountsStore.getState().accounts
                  const accountMatch = findMatchingAccount(
                    originalPsbt,
                    accounts
                  )
                  const matchedAccount = accountMatch?.account || account

                  let extractedData = null
                  if (originalPsbt && matchedAccount) {
                    try {
                      extractedData = extractTransactionDataFromPSBTEnhanced(
                        originalPsbt,
                        matchedAccount
                      )
                    } catch {
                      extractedData = null
                    }
                  }

                  const inputs = extractedData?.inputs || []
                  const outputs = extractedData?.outputs || []

                  const { size, vsize } = estimateTransactionSize(
                    inputs.length,
                    outputs.length
                  )

                  const collectedSignatures = Object.keys(
                    signedPsbts || {}
                  ).map(Number)

                  const vin = inputs.map((input) => ({
                    previousOutput: { txid: input.txid, vout: input.vout },
                    value: input.value,
                    label: input.label || ''
                  }))

                  const vout = outputs.map((output) => ({
                    address: output.address,
                    value: output.value,
                    label: output.label || ''
                  }))

                  const transaction = {
                    id: transactionId,
                    size,
                    vsize,
                    vin,
                    vout
                  } as unknown as Transaction

                  const visibility = visibleComponents.get(msg.id) || {
                    sankey: false,
                    status: false
                  }

                  return (
                    <SSVStack gap="md" style={{ paddingTop: 10 }}>
                      <SSHStack justifyBetween>
                        <SSText size="lg" weight="bold">
                          {t('account.transaction.signRequest')}
                        </SSText>
                        <SSText size="lg" color="muted">
                          {`${transactionId.slice(
                            0,
                            6
                          )}...${transactionId.slice(-6)}`}
                        </SSText>
                      </SSHStack>

                      {visibility.sankey ? (
                        <SSTransactionChart transaction={transaction} />
                      ) : (
                        <SSButton
                          label={t('transaction.loadSankey')}
                          onPress={() =>
                            handleToggleVisibility(msg.id, 'sankey')
                          }
                        />
                      )}

                      {visibility.status ? (
                        <SSSignatureRequiredDisplay
                          requiredNumber={keysRequired}
                          totalNumber={keyCount}
                          collectedSignatures={collectedSignatures}
                        />
                      ) : (
                        <SSButton
                          label={t('transaction.checkStatus')}
                          onPress={() =>
                            handleToggleVisibility(msg.id, 'status')
                          }
                        />
                      )}

                      <SSButton
                        label={t('account.transaction.signFlow')}
                        variant="secondary"
                        style={styles.signFlowButton}
                        onPress={() => handleGoToSignFlowClick(messageContent)}
                      />
                    </SSVStack>
                  )
                }
                return (
                  <>
                    <SSText size="md">{messageContent}</SSText>
                    <SSButton
                      label={t('account.transaction.signFlow')}
                      variant="secondary"
                      style={styles.signFlowButton}
                      onPress={() => handleGoToSignFlowClick(messageContent)}
                    />
                  </>
                )
              })()
            ) : (
              <SSText size="md">{messageContent}</SSText>
            )}
          </SSVStack>
        )
      } catch {
        return (
          <SSVStack gap="xxs" style={styles.message}>
            <SSText size="sm" color="muted">
              {t('account.nostrSync.devicesGroupChat.displayError')}
            </SSText>
          </SSVStack>
        )
      }
    },
    [
      account,
      formattedNpubs,
      handleGoToSignFlowClick,
      visibleComponents,
      handleToggleVisibility
    ]
  )

  if (!accountId || !account) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
            </SSHStack>
          ),
          headerRight: () => null
        }}
      />
      <SSVStack gap="sm" style={{ flex: 1 }}>
        <SSVStack gap="sm">
          <SSVStack gap="xs">
            <SSText center uppercase color="muted">
              {t('account.nostrSync.devicesGroupChat.title')}
              {account.nostr.autoSync
                ? t('account.nostrSync.devicesGroupChat.syncOn')
                : t('account.nostrSync.devicesGroupChat.syncOff')}
            </SSText>
          </SSVStack>
        </SSVStack>

        {/* Messages section */}
        <View style={styles.messagesContainer}>
          {!isContentLoaded && isInitialLoad && messages.length > 0 && (
            <View style={styles.loadingContainer}>
              <SSText center color="muted">
                {t('account.nostrSync.devicesGroupChat.loadingMessages')}
              </SSText>
            </View>
          )}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <SSText center color="muted">
                {t('account.nostrSync.devicesGroupChat.noMessages')}
              </SSText>
            }
            inverted={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            onContentSizeChange={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
            onLayout={() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: false })
              }
            }}
          />
        </View>

        {/* Message input section */}
        <SSHStack gap="sm" style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={messageInput}
            onChangeText={setMessageInput}
            placeholder={t(
              'account.nostrSync.devicesGroupChat.messagePlaceholder'
            )}
            placeholderTextColor={Colors.white}
            multiline
            maxLength={500}
          />
          <SSButton
            style={styles.sendButton}
            label={t('account.nostrSync.devicesGroupChat.sendButton')}
            onPress={handleSendMessage}
            disabled={isLoading || !messageInput.trim()}
          />
        </SSHStack>
      </SSVStack>
      <SSModal
        visible={isShareModalVisible}
        onClose={handleCancelShare}
        label=""
      >
        <View style={styles.modalContainer}>
          <SSVStack gap="xs" style={styles.modalContent}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {transactionDataForModal ? (
                (() => {
                  const { keysRequired, keyCount, signedPsbts, originalPsbt } =
                    transactionDataForModal

                  const txid = extractTransactionIdFromPSBT(originalPsbt)

                  if (!txid) {
                    return (
                      <SSText size="sm" color="muted">
                        {t('account.nostrSync.devicesGroupChat.invalidPsbt')}
                      </SSText>
                    )
                  }

                  const accounts = useAccountsStore.getState().accounts
                  const accountMatch = findMatchingAccount(
                    originalPsbt,
                    accounts
                  )
                  const matchedAccount = accountMatch?.account || account

                  let extractedData = null
                  if (originalPsbt && matchedAccount) {
                    try {
                      extractedData = extractTransactionDataFromPSBTEnhanced(
                        originalPsbt,
                        matchedAccount
                      )
                    } catch {
                      extractedData = null
                    }
                  }

                  const finalInputs = extractedData?.inputs || []
                  const finalOutputs = extractedData?.outputs || []

                  const { size, vsize } = estimateTransactionSize(
                    finalInputs.length,
                    finalOutputs.length
                  )
                  const collectedSignatures = Object.keys(
                    signedPsbts || {}
                  ).map(Number)
                  const vin = finalInputs.map((input) => ({
                    previousOutput: { txid: input.txid, vout: input.vout },
                    value: input.value,
                    label: input.label || ''
                  }))
                  const vout = finalOutputs.map((output) => ({
                    address: output.address,
                    value: output.value,
                    label: output.label || ''
                  }))
                  const transaction = {
                    id: txid,
                    size,
                    vsize,
                    vin,
                    vout
                  } as unknown as Transaction

                  return (
                    <SSVStack>
                      <SSHStack justifyBetween>
                        <SSText size="md" weight="bold">
                          {t('account.transaction.signRequest')}
                        </SSText>
                        <SSText size="md" color="muted">
                          {`${txid.slice(0, 6)}...${txid.slice(-6)}`}
                        </SSText>
                      </SSHStack>
                      <View style={styles.chartContainer}>
                        <SSTransactionChart transaction={transaction} />
                      </View>
                      <View style={styles.signatureContainer}>
                        <SSSignatureRequiredDisplay
                          requiredNumber={keysRequired}
                          totalNumber={keyCount}
                          collectedSignatures={collectedSignatures}
                        />
                      </View>
                    </SSVStack>
                  )
                })()
              ) : (
                <SSText style={styles.modalMessageText}>
                  {messageToShare}
                </SSText>
              )}
            </ScrollView>
            <SSVStack gap="xs" style={{ marginTop: 2 }}>
              <SSButton
                label={t('account.nostrSync.shareInChat')}
                onPress={handleShareInChat}
                loading={isLoading}
              />
              <SSButton
                label={t('common.cancel')}
                onPress={handleCancelShare}
                variant="ghost"
              />
            </SSVStack>
          </SSVStack>
        </View>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  messagesContainer: {
    flex: 1,
    paddingBottom: 8
  },
  message: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    paddingBottom: 15,
    paddingTop: 5,
    borderRadius: 8,
    marginTop: 8
  },
  deviceMessage: {
    backgroundColor: '#2a2a2a'
  },
  authorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 1,
    marginRight: 3
  },
  inputContainer: {
    paddingHorizontal: 0
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: Colors.white,
    padding: 10,
    borderRadius: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    flex: 0.8
  },
  sendButton: {
    flex: 0.2
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  signFlowButton: {
    marginTop: 8,
    alignSelf: 'flex-start'
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent'
  },
  modalContent: {
    backgroundColor: Colors.gray[900],
    paddingVertical: 6,
    paddingHorizontal: 12,
    width: '100%',
    minHeight: '60%',
    maxHeight: '85%',
    justifyContent: 'space-between'
  },
  modalScroll: {
    width: '100%'
  },
  modalScrollContent: {
    paddingBottom: 4
  },
  chartContainer: {
    width: '100%',
    overflow: 'hidden',
    paddingHorizontal: 2
  },
  signatureContainer: {
    alignItems: 'center'
  },
  modalMessageText: {
    maxHeight: 300
  }
})

export default SSDevicesGroupChat
