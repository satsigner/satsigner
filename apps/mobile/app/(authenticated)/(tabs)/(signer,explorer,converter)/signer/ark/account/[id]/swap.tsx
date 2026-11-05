import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSAmountInput from '@/components/SSAmountInput'
import SSArkSwapJobCard from '@/components/SSArkSwapJobCard'
import SSButton from '@/components/SSButton'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSShareableQR from '@/components/SSShareableQR'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSWalletSourceRow from '@/components/SSWalletSourceRow'
import { DUST_LIMIT } from '@/constants/btc'
import { PRIVACY_MASK } from '@/constants/privacy'
import { useArkBalance } from '@/hooks/useArkBalance'
import { useArkServerInfo } from '@/hooks/useArkBoard'
import {
  useArkSwapInvoiceSubmit,
  useArkSwapJobs,
  useArkSwapMaxInvoices,
  useArkSwapQuote,
  useArkSwapStart
} from '@/hooks/useArkSwaps'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useArkSwapsStore } from '@/store/arkSwaps'
import { Colors, Typography } from '@/styles'
import {
  type ArkSwapEndpointKind,
  type ArkSwapRoute,
  type ArkSwapStartResult
} from '@/types/models/ArkSwap'
import {
  getAccountKindLabel,
  getAccountKindLabelFromAccount
} from '@/utils/accountKindLabel'
import {
  getArkBoardAccountSources,
  resolveArkBoardSource
} from '@/utils/arkBoardSource'
import { getArkSweepDestinations } from '@/utils/arkOnchainSweep'
import {
  buildArkSwapRequest,
  clampArkSwapAmount,
  getArkSwapAmountRange,
  getArkSwapAmountSource,
  getArkSwapDestinationKinds,
  getArkSwapHops,
  getArkSwapJobAccountId,
  getArkSwapMinSats,
  resolveArkSwapRoute
} from '@/utils/arkSwap'
import { getAllClipboardContent, setClipboard } from '@/utils/clipboard'
import { formatNumber } from '@/utils/format'

const QR_SIZE = 260

const ENDPOINT_LABEL_KEYS: Record<ArkSwapEndpointKind, string> = {
  ark: 'ark.swap.endpoint.ark',
  lightning: 'ark.swap.endpoint.lightning',
  onchain: 'ark.swap.endpoint.onchain'
}

const ACTION_LABEL_KEYS: Record<ArkSwapRoute, string> = {
  arkToLightning: 'ark.swap.action.pay',
  arkToOnchain: 'ark.swap.action.send',
  lightningToArk: 'ark.swap.action.createInvoice',
  lightningToOnchain: 'ark.swap.action.createInvoice',
  onchainToArk: 'ark.swap.action.board',
  onchainToLightning: 'ark.swap.action.board'
}

type ReceivedInvoice = {
  invoice: string
  amountSats: number
}

function formatSats(amountSats: number, privacyMode: boolean): string {
  const amount = privacyMode ? PRIVACY_MASK : formatNumber(amountSats)
  return `${amount} ${t('bitcoin.sats')}`
}

function describeStartResult(
  result: ArkSwapStartResult,
  invoiceGiven: boolean
): string | undefined {
  const unit = t('bitcoin.sats')
  switch (result.route) {
    case 'arkToLightning': {
      return t('ark.swap.success.paid', {
        amount: formatNumber(result.amountSats),
        unit
      })
    }
    case 'arkToOnchain': {
      return t('ark.swap.success.sent', {
        amount: formatNumber(result.amountSats),
        name: result.destinationName,
        unit
      })
    }
    case 'lightningToOnchain': {
      return t('ark.swap.success.invoiceCreated')
    }
    case 'onchainToLightning': {
      if (result.invoiceHeld) {
        return t('ark.swap.success.boardHeld')
      }
      return invoiceGiven
        ? t('ark.swap.success.boardInvoiceTooShort')
        : t('ark.swap.success.boardLater')
    }
    default: {
      return undefined
    }
  }
}

async function copyValue(value: string) {
  if (await setClipboard(value)) {
    toast.success(t('common.copiedToClipboard'))
  }
}

export default function ArkSwapPage() {
  const { btcPrice, fiatCurrency, fiatEnabled, privacyMode } =
    useDisplayPreferences()
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  const account = useArkStore((state) =>
    state.accounts.find((arkAccount) => arkAccount.id === id)
  )
  const bitcoinAccounts = useAccountsStore((state) => state.accounts)
  const removeJob = useArkSwapsStore((state) => state.removeJob)

  const [fromKind, setFromKind] = useState<ArkSwapEndpointKind>(
    from ? 'onchain' : 'ark'
  )
  const [pickedToKind, setPickedToKind] =
    useState<ArkSwapEndpointKind>('lightning')
  const [pickedSourceId, setPickedSourceId] = useState(from)
  const [pickedDestinationId, setPickedDestinationId] = useState<string>()
  const [amountSats, setAmountSats] = useState(0)
  const [invoice, setInvoice] = useState('')
  const [receivedInvoice, setReceivedInvoice] = useState<ReceivedInvoice>()
  const [formVersion, setFormVersion] = useState(0)

  const balanceQuery = useArkBalance(id)
  const serverInfoQuery = useArkServerInfo(id)
  const jobs = useArkSwapJobs(id)
  const getMaxInvoiceSats = useArkSwapMaxInvoices(jobs)
  const startMutation = useArkSwapStart()
  const submitMutation = useArkSwapInvoiceSubmit(id)

  const network = account?.network ?? 'signet'
  const minBoardSats = serverInfoQuery.data?.minBoardAmountSats ?? DUST_LIMIT
  const sources = getArkBoardAccountSources(bitcoinAccounts, network)
  const source = resolveArkBoardSource(sources, pickedSourceId, minBoardSats)
  const destinations = getArkSweepDestinations(bitcoinAccounts, network)
  const destination =
    destinations.find((candidate) => candidate.id === pickedDestinationId) ??
    destinations[0]

  const toKinds = getArkSwapDestinationKinds(fromKind)
  const toKind = toKinds.includes(pickedToKind) ? pickedToKind : toKinds[0]
  const route = resolveArkSwapRoute(fromKind, toKind)
  const amountSource = route ? getArkSwapAmountSource(route, invoice) : 'input'
  const amountRange = getArkSwapAmountRange({
    arkSpendableSats: balanceQuery.data?.spendableSats ?? 0,
    fromKind,
    minBoardSats,
    sourceBalanceSats: source?.availableSats ?? 0
  })
  const requestAmountSats = clampArkSwapAmount(amountSats, amountRange)

  const form = {
    arkAccountId: id,
    destinationAccountId: destination?.id,
    fromKind,
    sourceAccountId: source?.id,
    toKind
  }
  const request = buildArkSwapRequest({
    ...form,
    amountSats: requestAmountSats,
    invoice
  })
  const debouncedAmountSats = useDebouncedValue(requestAmountSats)
  const debouncedInvoice = useDebouncedValue(invoice)
  const quoteQuery = useArkSwapQuote(
    buildArkSwapRequest({
      ...form,
      amountSats: debouncedAmountSats,
      invoice: debouncedInvoice
    })
  )
  const quote = request ? quoteQuery.data : undefined

  const hopLabels = getArkSwapHops(fromKind, toKind).map((kind, index) => {
    if (kind !== 'onchain') {
      return t(ENDPOINT_LABEL_KEYS[kind])
    }
    const wallet = index === 0 ? source : destination
    return wallet?.name ?? t(ENDPOINT_LABEL_KEYS.onchain)
  })
  const accountNames = new Map(
    bitcoinAccounts.map((bitcoinAccount) => [
      bitcoinAccount.id,
      bitcoinAccount.name
    ])
  )
  const actionLabel =
    route === 'arkToOnchain'
      ? t(ACTION_LABEL_KEYS.arkToOnchain, { name: destination?.name ?? '' })
      : t(ACTION_LABEL_KEYS[route ?? 'arkToLightning'])

  function handleFromChange(kind: ArkSwapEndpointKind) {
    setFromKind(kind)
    setReceivedInvoice(undefined)
  }

  function handleToChange(kind: ArkSwapEndpointKind) {
    setPickedToKind(kind)
    setReceivedInvoice(undefined)
  }

  async function handlePasteInvoice() {
    const pasted = await getAllClipboardContent()
    if (pasted) {
      setInvoice(pasted.trim())
    }
  }

  function handleCopyReceivedInvoice() {
    if (receivedInvoice) {
      copyValue(receivedInvoice.invoice)
    }
  }

  function handleNewSwap() {
    setReceivedInvoice(undefined)
    setAmountSats(0)
    setInvoice('')
    setFormVersion((version) => version + 1)
  }

  function handleStart() {
    if (!request) {
      return
    }
    const invoiceGiven = invoice.trim() !== ''
    startMutation.mutate(request, {
      onError: (error) => {
        toast.error(`${t('ark.swap.error.generic')}: ${error.message}`)
      },
      onSuccess: (result) => {
        if (result.route === 'lightningToArk') {
          setReceivedInvoice(result)
          return
        }
        handleNewSwap()
        const message = describeStartResult(result, invoiceGiven)
        if (message) {
          toast.success(message)
        }
      }
    })
  }

  function handleSubmitInvoice(jobId: string, jobInvoice: string) {
    submitMutation.mutate(
      { invoice: jobInvoice, jobId },
      {
        onError: (error) => {
          toast.error(`${t('ark.swap.error.generic')}: ${error.message}`)
        }
      }
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.swap.title')}</SSText>
        }}
      />
      <SSScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          <SSText color="muted" size="xs">
            {t('ark.swap.description')}
          </SSText>
          {network === 'bitcoin' && (
            <SSText size="xs" style={{ color: Colors.warning }}>
              {t('ark.swap.mainnetWarning')}
            </SSText>
          )}

          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.swap.from')}
            </SSText>
            <SSPairedTabs<ArkSwapEndpointKind>
              activeTab={fromKind}
              primary={{ key: 'ark', label: t(ENDPOINT_LABEL_KEYS.ark) }}
              secondary={{
                key: 'lightning',
                label: t(ENDPOINT_LABEL_KEYS.lightning)
              }}
              tertiary={{
                key: 'onchain',
                label: t(ENDPOINT_LABEL_KEYS.onchain)
              }}
              onChange={handleFromChange}
            />
          </SSVStack>

          {fromKind === 'onchain' && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.swap.sourceWallet')}
              </SSText>
              {sources.length === 0 && (
                <SSText size="xs" style={{ color: Colors.warning }}>
                  {t('ark.swap.noSourceWallets')}
                </SSText>
              )}
              {sources.map((candidate) => (
                <SSWalletSourceRow
                  key={candidate.id}
                  id={candidate.id}
                  title={candidate.name}
                  subtitle={getAccountKindLabel(candidate)}
                  availableSats={candidate.availableSats}
                  privacyMode={privacyMode}
                  selected={candidate.id === source?.id}
                  onSelect={setPickedSourceId}
                />
              ))}
            </SSVStack>
          )}

          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.swap.to')}
            </SSText>
            <SSPairedTabs<ArkSwapEndpointKind>
              activeTab={toKind}
              primary={{
                key: toKinds[0],
                label: t(ENDPOINT_LABEL_KEYS[toKinds[0]])
              }}
              secondary={{
                key: toKinds[1],
                label: t(ENDPOINT_LABEL_KEYS[toKinds[1]])
              }}
              onChange={handleToChange}
            />
          </SSVStack>

          {toKind === 'onchain' && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.swap.destinationWallet')}
              </SSText>
              {destinations.length === 0 && (
                <SSText size="xs" style={{ color: Colors.warning }}>
                  {t('ark.swap.noDestinationWallets')}
                </SSText>
              )}
              {destinations.map((candidate) => (
                <SSWalletSourceRow
                  key={candidate.id}
                  id={candidate.id}
                  title={candidate.name}
                  subtitle={getAccountKindLabelFromAccount(candidate)}
                  availableSats={candidate.summary.balance}
                  privacyMode={privacyMode}
                  selected={candidate.id === destination?.id}
                  onSelect={setPickedDestinationId}
                />
              ))}
            </SSVStack>
          )}

          <SSText center size="sm" style={styles.hops}>
            {hopLabels.join('  →  ')}
          </SSText>

          {receivedInvoice && (
            <SSVStack gap="md">
              <SSShareableQR
                value={receivedInvoice.invoice}
                size={QR_SIZE}
                containerStyle={styles.qrContainer}
              >
                <View style={styles.valueBox}>
                  <SSText size="xs" style={styles.monospace} numberOfLines={4}>
                    {receivedInvoice.invoice}
                  </SSText>
                </View>
                <SSText color="muted" size="sm" center>
                  {formatSats(receivedInvoice.amountSats, privacyMode)}
                </SSText>
                <SSButton
                  label={t('common.copy')}
                  onPress={handleCopyReceivedInvoice}
                  variant="outline"
                />
              </SSShareableQR>
              <SSText color="muted" size="xs" center>
                {t('ark.swap.invoiceReady')}
              </SSText>
              <SSButton
                label={t('ark.swap.newSwap')}
                onPress={handleNewSwap}
                variant="subtle"
              />
            </SSVStack>
          )}

          {!receivedInvoice && toKind === 'lightning' && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.swap.invoice')}
              </SSText>
              <SSTextInput
                align="left"
                size="small"
                multiline
                value={invoice}
                onChangeText={setInvoice}
                placeholder={t('ark.swap.invoicePlaceholder')}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.invoiceInput}
              />
              <SSButton
                label={t('common.paste')}
                onPress={handlePasteInvoice}
                variant="subtle"
              />
              {route === 'onchainToLightning' && (
                <SSText color="muted" size="xs">
                  {t('ark.swap.invoiceOptional')}
                </SSText>
              )}
            </SSVStack>
          )}

          {!receivedInvoice && amountSource === 'input' && amountRange && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.swap.amount')} ({t('bitcoin.sats')})
              </SSText>
              <SSAmountInput
                key={`${formVersion}-${amountRange.minSats}-${amountRange.maxSats}`}
                btcPrice={btcPrice}
                fiatCurrency={fiatCurrency}
                fiatEnabled={fiatEnabled}
                privacyMode={privacyMode}
                min={amountRange.minSats}
                max={amountRange.maxSats}
                value={requestAmountSats}
                onValueChange={setAmountSats}
              />
            </SSVStack>
          )}
          {!receivedInvoice && amountSource === 'input' && !amountRange && (
            <SSText size="xs" style={{ color: Colors.warning }}>
              {t('ark.swap.insufficientBalance', {
                amount: formatNumber(getArkSwapMinSats(fromKind, minBoardSats)),
                unit: t('bitcoin.sats')
              })}
            </SSText>
          )}

          {!receivedInvoice && quote && (
            <SSVStack gap="xxs">
              <SSHStack justifyBetween style={styles.row}>
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.swap.quote.send')}
                </SSText>
                <SSText size="sm">
                  {formatSats(quote.sendSats, privacyMode)}
                </SSText>
              </SSHStack>
              <SSHStack justifyBetween style={styles.row}>
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.swap.quote.fee')}
                </SSText>
                <SSText size="sm">
                  {formatSats(quote.feeSats, privacyMode)}
                </SSText>
              </SSHStack>
              <SSHStack justifyBetween style={styles.row}>
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.swap.quote.receive')}
                </SSText>
                <SSText size="sm">
                  {formatSats(quote.receiveSats, privacyMode)}
                </SSText>
              </SSHStack>
              {fromKind === 'onchain' && (
                <SSText color="muted" size="xs">
                  {t('ark.swap.quote.minerFeeLater')}
                </SSText>
              )}
            </SSVStack>
          )}
          {!receivedInvoice && request && quoteQuery.error && (
            <SSText size="xs" style={{ color: Colors.warning }}>
              {quoteQuery.error.message || t('ark.swap.quote.error')}
            </SSText>
          )}

          {!receivedInvoice && (
            <SSButton
              label={actionLabel}
              onPress={handleStart}
              loading={startMutation.isPending}
              disabled={!request || !!quoteQuery.error}
              variant="gradient"
              gradientType="special"
            />
          )}

          {jobs.length > 0 && (
            <SSVStack gap="sm">
              <SSText uppercase>{t('ark.swap.jobs.title')}</SSText>
              {jobs.map((job) => (
                <SSArkSwapJobCard
                  key={job.id}
                  job={job}
                  walletName={accountNames.get(getArkSwapJobAccountId(job))}
                  maxInvoiceSats={getMaxInvoiceSats(job.id)}
                  privacyMode={privacyMode}
                  submitting={
                    submitMutation.isPending &&
                    submitMutation.variables?.jobId === job.id
                  }
                  onDismiss={removeJob}
                  onSubmitInvoice={handleSubmitInvoice}
                  onCopy={copyValue}
                  onPaste={getAllClipboardContent}
                />
              ))}
            </SSVStack>
          )}
        </SSVStack>
      </SSScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  hops: {
    color: Colors.gray[300],
    paddingVertical: 4
  },
  invoiceInput: {
    fontFamily: Typography.geistMonoRegular,
    height: 88,
    paddingTop: 12,
    textAlignVertical: 'top'
  },
  monospace: {
    fontFamily: Typography.geistMonoRegular
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 16
  },
  row: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8
  },
  valueBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 10
  }
})
