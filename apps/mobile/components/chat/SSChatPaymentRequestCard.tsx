import { StyleSheet, View } from 'react-native'

import { SSIconLightning } from '@/components/icons'
import SSAmountDisplay from '@/components/SSAmountDisplay'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { MS_PER_SECOND } from '@/constants/time'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'
import type { Network } from '@/types/settings/blockchain'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import type {
  ChatBitcoinRequest,
  ChatInvoice,
  ChatPaymentRequest
} from '@/utils/chatPaymentRequests'
import { formatAddress, formatFiatPrice } from '@/utils/format'
import { formatExpiresRelative } from '@/utils/relativeTime'

const HEADER_ICON_SIZE = 14
const FALLBACK_ICON_SIZE = 8
const BITCOIN_BADGE_SIZE = 16
const INVOICE_PREVIEW_CHARS = 14

type SSChatPaymentRequestCardProps = {
  request: ChatPaymentRequest
  displayPreferences: DisplayPreferences
  /** Unix ms, ticking, so an invoice greys out as it expires. */
  nowMs: number
  expired: boolean
  /** The request is for another network than any wallet that could pay it. */
  wrongNetwork: boolean
  canPay: boolean
  onPay: (request: ChatPaymentRequest) => void
  onCopy: (text: string) => void
}

type DetailsProps<T> = {
  request: T
  displayPreferences: DisplayPreferences
}

function shortenInvoice(invoice: string) {
  if (invoice.length <= INVOICE_PREVIEW_CHARS * 2) {
    return invoice
  }
  return `${invoice.slice(0, INVOICE_PREVIEW_CHARS)}…${invoice.slice(-INVOICE_PREVIEW_CHARS)}`
}

function getCopyText(request: ChatPaymentRequest) {
  return request.kind === 'lightning' ? request.invoice : request.uri
}

function getTitle(request: ChatPaymentRequest) {
  return request.kind === 'lightning'
    ? t('nostrIdentity.chat.invoice.title')
    : t('nostrIdentity.chat.payment.bitcoinRequest')
}

function isTestNetwork(network: Network | null): network is Network {
  return network !== null && network !== 'bitcoin'
}

function PaymentAmount({
  amountSats,
  displayPreferences
}: {
  amountSats: number
  displayPreferences: DisplayPreferences
}) {
  const {
    btcPrice,
    currencyUnit,
    fiatCurrency,
    fiatEnabled,
    privacyMode,
    useZeroPadding
  } = displayPreferences

  if (amountSats <= 0) {
    return (
      <SSText size="lg" color="muted">
        {t('nostrIdentity.chat.invoice.anyAmount')}
      </SSText>
    )
  }

  const showFiat = fiatEnabled && btcPrice > 0 && !privacyMode
  return (
    <SSVStack gap="none">
      <SSHStack gap="xs" style={styles.amountRow}>
        <SSAmountDisplay
          privacyMode={privacyMode}
          amount={amountSats}
          decimals={0}
          useZeroPadding={useZeroPadding}
          currency={currencyUnit}
          textSize="2xl"
          weight="light"
          letterSpacing={Typography.amountLetterSpacing.card}
          unitSize="xs"
        />
      </SSHStack>
      {showFiat ? (
        <SSText size="xs" color="muted">
          ≈ {formatFiatPrice(amountSats, btcPrice)} {fiatCurrency}
        </SSText>
      ) : null}
    </SSVStack>
  )
}

function LightningDetails({
  request,
  displayPreferences
}: DetailsProps<ChatInvoice>) {
  return (
    <SSVStack gap="xs">
      <PaymentAmount
        amountSats={request.amountSats}
        displayPreferences={displayPreferences}
      />
      {request.description ? (
        <SSText size="sm" numberOfLines={3}>
          {request.description}
        </SSText>
      ) : null}
      <SSText type="mono" size="xxs" color="muted" numberOfLines={1}>
        {shortenInvoice(request.invoice)}
      </SSText>
    </SSVStack>
  )
}

function BitcoinDetails({
  request,
  displayPreferences
}: DetailsProps<ChatBitcoinRequest>) {
  return (
    <SSVStack gap="xs">
      <PaymentAmount
        amountSats={request.amountSats}
        displayPreferences={displayPreferences}
      />
      {request.label ? (
        <SSText size="sm" weight="medium" numberOfLines={2}>
          {request.label}
        </SSText>
      ) : null}
      {request.message ? (
        <SSText size="sm" color="muted" numberOfLines={3}>
          {request.message}
        </SSText>
      ) : null}
      <SSText type="mono" size="xxs" color="muted" numberOfLines={1}>
        {formatAddress(request.address)}
      </SSText>
      {request.hasLightningFallback ? (
        <SSHStack gap="xxs" style={styles.centered}>
          <SSIconLightning
            width={FALLBACK_ICON_SIZE}
            height={FALLBACK_ICON_SIZE}
            color={Colors.gray[100]}
          />
          <SSText size="xxs" color="muted">
            {t('nostrIdentity.chat.payment.lightningFallback')}
          </SSText>
        </SSHStack>
      ) : null}
    </SSVStack>
  )
}

function RequestIcon({ kind }: { kind: ChatPaymentRequest['kind'] }) {
  if (kind === 'lightning') {
    return (
      <SSIconLightning
        width={HEADER_ICON_SIZE}
        height={HEADER_ICON_SIZE}
        color={Colors.warning}
      />
    )
  }
  return (
    <View style={styles.bitcoinBadge}>
      <SSText size="xxs" weight="bold" style={styles.bitcoinGlyph}>
        ₿
      </SSText>
    </View>
  )
}

function ExpiryLabel({
  request,
  expired,
  nowMs
}: {
  request: ChatPaymentRequest
  expired: boolean
  nowMs: number
}) {
  if (expired) {
    return (
      <SSText size="xs" style={styles.expiredText}>
        {t('nostrIdentity.chat.invoice.expired')}
      </SSText>
    )
  }
  if (request.kind !== 'lightning' || request.expiresAt === null) {
    return null
  }
  return (
    <SSText size="xs" color="muted">
      {t('nostrIdentity.chat.payment.expires', {
        relative: formatExpiresRelative(
          request.expiresAt * MS_PER_SECOND,
          nowMs
        )
      })}
    </SSText>
  )
}

function SSChatPaymentRequestCard({
  request,
  displayPreferences,
  nowMs,
  expired,
  wrongNetwork,
  canPay,
  onPay,
  onCopy
}: SSChatPaymentRequestCardProps) {
  function handlePay() {
    onPay(request)
  }

  function handleCopy() {
    onCopy(getCopyText(request))
  }

  return (
    <View style={[styles.card, expired && styles.cardExpired]}>
      <SSVStack gap="sm">
        <SSHStack justifyBetween style={styles.centered}>
          <SSHStack gap="xs" style={styles.centered}>
            <RequestIcon kind={request.kind} />
            <SSText size="xs" color="muted" uppercase>
              {getTitle(request)}
            </SSText>
          </SSHStack>
          {isTestNetwork(request.network) ? (
            <View style={styles.networkBadge}>
              <SSText size="xxs" uppercase style={styles.networkText}>
                {t(`bitcoin.network.${request.network}`)}
              </SSText>
            </View>
          ) : null}
        </SSHStack>
        {request.kind === 'lightning' ? (
          <LightningDetails
            request={request}
            displayPreferences={displayPreferences}
          />
        ) : (
          <BitcoinDetails
            request={request}
            displayPreferences={displayPreferences}
          />
        )}
        <ExpiryLabel request={request} expired={expired} nowMs={nowMs} />
        {wrongNetwork ? (
          <SSText size="xs" style={styles.warningText}>
            {t('nostrIdentity.chat.invoice.wrongNetwork')}
          </SSText>
        ) : null}
        <SSHStack gap="sm">
          <View style={styles.button}>
            <SSButton
              label={t('nostrIdentity.chat.invoice.pay')}
              onPress={handlePay}
              disabled={expired || wrongNetwork || !canPay}
            />
          </View>
          <View style={styles.button}>
            <SSButton
              label={t('common.copy')}
              onPress={handleCopy}
              variant="outline"
            />
          </View>
        </SSHStack>
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  amountRow: {
    alignItems: 'baseline'
  },
  bitcoinBadge: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BITCOIN_BADGE_SIZE / 2,
    height: BITCOIN_BADGE_SIZE,
    justifyContent: 'center',
    width: BITCOIN_BADGE_SIZE
  },
  bitcoinGlyph: {
    color: Colors.black
  },
  button: {
    flex: 1
  },
  card: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    padding: 12
  },
  cardExpired: {
    opacity: 0.6
  },
  centered: {
    alignItems: 'center'
  },
  expiredText: {
    color: Colors.error
  },
  networkBadge: {
    borderColor: Colors.warning,
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1
  },
  networkText: {
    color: Colors.warning
  },
  warningText: {
    color: Colors.warning
  }
})

export default SSChatPaymentRequestCard
