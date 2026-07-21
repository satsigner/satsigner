import { useCallback, useState } from 'react'

import { sendPayjoin } from '@/api/payjoin'
import { useBlockchainStore } from '@/store/blockchain'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { useSettingsStore } from '@/store/settings'
import { type Account } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { type PayjoinSendResult } from '@/types/payjoin'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { hasPayjoinParam } from '@/utils/payjoinUri'
import { buildPayjoinWalletCallbacks } from '@/utils/payjoinWallet'

type UsePayjoinSenderParams = {
  account?: Account
  outputs: Output[]
  inputs: Utxo[]
  payjoinUri?: string
  signPsbt: (psbtBase64: string) => Promise<string> | string
}

function usePayjoinSender({
  account,
  outputs,
  inputs,
  payjoinUri,
  signPsbt
}: UsePayjoinSenderParams) {
  const payjoinEnabled = useSettingsStore((s) => s.payjoinEnabled)
  const networkName = useBlockchainStore((s) => s.network)
  const [negotiating, setNegotiating] = useState(false)
  const [lastResult, setLastResult] = useState<PayjoinSendResult | null>(null)

  const shouldAttempt =
    payjoinEnabled &&
    account?.policyType === 'singlesig' &&
    !!payjoinUri &&
    hasPayjoinParam(payjoinUri)

  const attemptPayjoin = useCallback(
    async (originalPsbtBase64: string): Promise<PayjoinSendResult> => {
      if (!shouldAttempt || !payjoinUri) {
        return {
          ok: true,
          originalPsbtBase64,
          reason: 'payjoin not applicable',
          usedPayjoin: false
        }
      }

      setNegotiating(true)
      try {
        const store = usePayjoinSessionsStore.getState()
        const network = bitcoinjsNetwork(networkName)
        const paymentAmountSats = outputs.reduce(
          (sum, o) =>
            sum + (o.kind === 'change' || o.kind === 'fakeMix' ? 0 : o.amount),
          0
        )
        const callbacks = buildPayjoinWalletCallbacks({
          hasSeenInput: (outpoint) => store.hasSeenInput(outpoint),
          markInputSeen: (outpoint) => store.markInputSeen(outpoint),
          network,
          outputs,
          ownedAddresses: [
            ...(account?.addresses ?? []).map((a) => a.address),
            ...outputs.filter((o) => o.kind === 'change').map((o) => o.to)
          ].filter(Boolean),
          signPsbt,
          utxos: inputs
        })

        const result = await sendPayjoin({
          callbacks,
          originalPsbtBase64,
          outputScriptsHex: callbacks.outputScriptsHex,
          payjoinUri,
          paymentAmountSats
        })
        setLastResult(result)
        return result
      } finally {
        setNegotiating(false)
      }
    },
    [
      account?.addresses,
      inputs,
      networkName,
      outputs,
      payjoinUri,
      shouldAttempt,
      signPsbt
    ]
  )

  return {
    attemptPayjoin,
    lastResult,
    negotiating,
    shouldAttempt
  }
}

export { usePayjoinSender }
