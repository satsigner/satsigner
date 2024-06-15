import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getItem, setItem } from '@/storage/encrypted'
import mmkvStorage from '@/storage/mmkv'

const PIN_KEY = 'satsigner_pin'

type AuthState = {
  firstTime: boolean
  requiresAuth: boolean
}

type AuthAction = {
  setFirstTime: (firstTime: boolean) => void
  setPin: (pin: string) => Promise<void>
  validatePin: (pin: string) => Promise<boolean>
}

const useAuthStore = create<AuthState & AuthAction>()(
  persist(
    (set) => ({
      firstTime: true,
      requiresAuth: false,
      setFirstTime: (firstTime: boolean) => {
        set({ firstTime })
      },
      setPin: async (pin) => {
        await setItem(PIN_KEY, pin)
      },
      validatePin: async (pin) => {
        const savedPin = await getItem(PIN_KEY)
        return pin === savedPin
      }
    }),
    {
      name: 'satsigner-auth',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useAuthStore }
