import { useRouter } from 'expo-router'
import { KeychainKind } from 'react-native-bdk-sdk'
import { useShallow } from 'zustand/react/shallow'

import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type TourStep, useTourStore } from '@/store/tour'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'

const TOUR_FEE_SATS = 500

function useTourNavigation() {
  const router = useRouter()

  const [
    currentStep,
    accountId,
    advanceStep,
    exitTour,
    completeTour,
    setNeverAskAgain,
    dismissSettingsBanner,
    startTour,
    resetTour
  ] = useTourStore(
    useShallow((state) => [
      state.currentStep,
      state.accountId,
      state.advanceStep,
      state.exitTour,
      state.completeTour,
      state.setNeverAskAgain,
      state.dismissSettingsBanner,
      state.startTour,
      state.resetTour
    ])
  )

  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === accountId)
  )

  const wallet = useWalletsStore((state) =>
    accountId ? state.wallets[accountId] : undefined
  )

  const setSelectedNetwork = useBlockchainStore(
    (state) => state.setSelectedNetwork
  )

  const [addInput, addOutput, clearTransaction, setAccountId, setFee] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.addInput,
        state.addOutput,
        state.clearTransaction,
        state.setAccountId,
        state.setFee
      ])
    )

  function handleExit() {
    exitTour()
  }

  function handleComplete() {
    completeTour()
    router.dismissAll()
    if (accountId) {
      router.navigate(`/signer/bitcoin/account/${accountId}`)
    } else {
      router.navigate('/')
    }
  }

  function handleNeverAskAgain() {
    setNeverAskAgain()
    dismissSettingsBanner()
  }

  function handleStartTour() {
    startTour()
  }

  function handleRestartTour() {
    resetTour()
    startTour()
    advanceStep('account_setup')
    router.navigate('/signer/bitcoin/account/add?tourMode=true')
  }

  function advance(step: TourStep, idOverride?: string) {
    if (step === 'go_to_bitcoin') {
      advanceGoToBitcoin()
    } else if (step === 'account_setup') {
      advanceAccountSetup(idOverride)
    } else if (step === 'explore_wallet') {
      advanceExploreWallet()
    } else if (step === 'receive') {
      advanceReceive()
    } else if (step === 'select_utxos') {
      advanceSelectUtxos()
    } else if (step === 'preview_tx') {
      advancePreviewTx()
    } else if (step === 'sign_tx') {
      advanceSignTx()
    }
  }

  function advanceGoToBitcoin() {
    advanceStep('add_account')
    router.navigate('/signer/bitcoin/accountList')
  }

  function advanceSignTx() {
    advanceStep('broadcast_confirm')
  }

  function advancePreviewTx() {
    if (!accountId) {
      return
    }
    advanceStep('sign_tx')
    router.navigate(
      `/signer/bitcoin/account/${accountId}/signAndSend/signTransaction`
    )
  }

  function advanceAccountSetup(idOverride?: string) {
    const targetId = idOverride ?? accountId
    if (!targetId) {
      router.navigate('/signer/bitcoin/account/add?tourMode=true' as never)
      return
    }
    setSelectedNetwork('signet')
    advanceStep('explore_wallet')
    router.navigate('/signer/bitcoin/accountList')
  }

  function advanceExploreWallet() {
    if (!accountId) {
      return
    }
    advanceStep('receive')
    router.navigate(`/signer/bitcoin/account/${accountId}/receive`)
  }

  function advanceReceive() {
    if (!account || !accountId) {
      return
    }
    if (account.utxos.length === 0) {
      advanceStep('no_utxos')
      return
    }
    advanceStep('select_utxos')
    router.navigate(
      `/signer/bitcoin/account/${accountId}/signAndSend/selectUtxoList`
    )
  }

  function advanceSelectUtxos() {
    if (!account || !wallet || !accountId) {
      return
    }

    const { utxos } = account
    if (utxos.length === 0) {
      advanceStep('no_utxos')
      return
    }

    clearTransaction()
    setAccountId(accountId)

    const totalInputSats = utxos.reduce((sum, u) => sum + u.value, 0)
    const outputCount = utxos.length + 1
    const perOutputAmount = Math.floor(
      (totalInputSats - TOUR_FEE_SATS) / outputCount
    )

    for (const utxo of utxos) {
      addInput(utxo)
    }

    const selfSendLabel = t('tour.selfSendLabel')
    for (let i = 0; i < outputCount; i += 1) {
      try {
        const addrInfo = wallet.peekAddress(KeychainKind.External, i)
        addOutput({
          amount: perOutputAmount,
          label: selfSendLabel,
          to: addrInfo.address
        })
      } catch {
        break
      }
    }

    setFee(TOUR_FEE_SATS)

    advanceStep('preview_tx')
    router.navigate(
      `/signer/bitcoin/account/${accountId}/signAndSend/previewTransaction`
    )
  }

  return {
    account,
    accountId,
    advance,
    currentStep,
    handleComplete,
    handleExit,
    handleNeverAskAgain,
    handleRestartTour,
    handleStartTour,
    wallet
  }
}

export { useTourNavigation }
