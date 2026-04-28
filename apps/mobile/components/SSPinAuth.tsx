import { useEffect, useState } from 'react'
import Animated  from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSPinInput, { type SSPinInputProps } from '@/components/SSPinInput'
import SSText from '@/components/SSText'
import { DURESS_PIN_KEY, PIN_KEY, SALT_KEY } from '@/config/auth'
import { useAnimatedShake } from '@/hooks/useAnimatedShake'
import SSVStack from '@/layouts/SSVStack'
import { deleteItem, getItem } from '@/storage/encrypted'
import { useAuthStore } from '@/store/auth'
import { gray } from '@/styles/colors'
import { pbkdf2Encrypt } from '@/utils/crypto'
import { emptyPin } from '@/utils/pin'
import { router } from 'expo-router'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'

type SSPinAuthProps = {
  title?: string
  onFail: () => void
  onSuccess: () => void
  resetPin?: boolean
} & Pick<SSPinInputProps, 'feedbackBold' | 'feedbackColor' | 'feedbackText'>

function SSPinAuth({ title, onFail, onSuccess, resetPin, ...props }: SSPinAuthProps) {
  const [duressPinEnabled, setDuressPinEnabled] = useAuthStore(
    useShallow((state) => [state.duressPinEnabled, state.setDuressPinEnabled])
  )
  const [deleteAccounts, deleteTags] = useAccountsStore(
    useShallow((state) => [
      state.deleteAccounts,
      state.deleteTags,
    ])
  )
  const deleteWallets = useWalletsStore(state => state.deleteWallets)
  const [pin, setPin] = useState<string[]>(emptyPin())
  const { shakeStyle } = useAnimatedShake()

  useEffect(() => {
    if (resetPin === true) {
      setPin(emptyPin())
    }
  }, [resetPin])

  async function handleFillEnded(inputPin: string) {
    const hashedPin = await getItem(PIN_KEY)
    const hashedDuressPin = await getItem(DURESS_PIN_KEY)
    const salt = await getItem(SALT_KEY)
    if (!hashedPin || !salt) {
      toast.error('Failed to retrieve PIN for authentication')
      return
    }
    const hashedInput = await pbkdf2Encrypt(inputPin, salt)

    // DURESS PIN
    if (duressPinEnabled && hashedInput === hashedDuressPin) {
      // erase data
      deleteAccounts()
      deleteWallets()
      deleteTags()

      // delete evidence there existed a duress pin in the first place,
      // acting as if the duress pin was the true pin
      setDuressPinEnabled(false)
      await deleteItem(DURESS_PIN_KEY)

      // reset route
      router.dismissAll()
      router.push('/')
      return
    }

    // Upon failure, the pin reset is already done here
    // The fail callback could be show a warning, dismiss a modal, etc...
    if (hashedInput !== hashedPin) {
      setPin(emptyPin())
      onFail()
      return
    }
    
    // The success callback could be unlock the app, or view mnemonic, or confirm wallet deletion
    onSuccess()
  }

  return (
    <SSVStack
      itemsCenter
      gap={title ? 'lg' : 'none'}
      style={{ flex: 1, width: '100%' }}
    >
      {title && (
        <SSText
          uppercase
          size="lg"
          color="muted"
          center
          style={{ color: gray[300] }}
        >
          {title}
        </SSText>
      )}
      <Animated.View style={[{ flex: 1, width: '100%' }, shakeStyle]}>
        <SSPinInput
          pin={pin}
          setPin={setPin}
          onFillEnded={handleFillEnded}
          {...props}
        />
      </Animated.View>
    </SSVStack>
  )
}

export default SSPinAuth