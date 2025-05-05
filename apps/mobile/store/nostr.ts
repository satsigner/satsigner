import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { nip19 } from 'nostr-tools'

import mmkvStorage from '@/storage/mmkv'
import { sha256 } from '@/utils/crypto'

type Member = {
  npub: string
  color: string
}

type NostrState = {
  members: {
    [accountId: string]: Member[]
  }
}

type NostrAction = {
  addMember: (accountId: string, npub: string) => void
  removeMember: (accountId: string, npub: string) => void
  getMembers: (accountId: string) => Member[]
  clearMembers: (accountId: string) => void
}

async function generateColorFromNpub(npub: string): Promise<string> {
  // Convert npub to pubkey
  const decoded = nip19.decode(npub)
  if (!decoded || decoded.type !== 'npub') {
    throw new Error('Invalid npub')
  }
  const pubkey = decoded.data

  // Generate color from hash
  const hash = await sha256(pubkey)
  const seed = parseInt(hash.slice(0, 8), 16) // Only use first 8 chars for faster calculation
  const hue = seed % 360
  const saturation = 100 // Full saturation (255/255 * 100 = 100%)
  const lightness = 70 // 180/255 * 100 ≈ 70% for dark mode

  // Convert HSL to hex color
  const h = hue / 360
  const s = saturation / 100
  const l = lightness / 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
  const m = l - c / 2

  let r, g, b
  if (h < 1 / 6) [r, g, b] = [c, x, 0]
  else if (h < 2 / 6) [r, g, b] = [x, c, 0]
  else if (h < 3 / 6) [r, g, b] = [0, c, x]
  else if (h < 4 / 6) [r, g, b] = [0, x, c]
  else if (h < 5 / 6) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const useNostrStore = create<NostrState & NostrAction>()(
  persist(
    (set, get) => ({
      members: {},
      addMember: async (accountId, npub) => {
        const currentMembers = get().members[accountId] || []
        console.log('Adding member:', { accountId, npub, currentMembers })
        if (!currentMembers.some((m) => m.npub === npub)) {
          const color = await generateColorFromNpub(npub)
          set((state) => {
            const newState = {
              members: {
                ...state.members,
                [accountId]: [...currentMembers, { npub, color }]
              }
            }
            return newState
          })
        }
      },
      removeMember: (accountId, npub) => {
        set((state) => {
          const currentMembers = state.members[accountId] || []
          return {
            members: {
              ...state.members,
              [accountId]: currentMembers.filter((m) => m.npub !== npub)
            }
          }
        })
      },
      getMembers: (accountId) => {
        return get().members[accountId] || []
      },
      clearMembers: (accountId) => {
        set((state) => ({
          members: {
            ...state.members,
            [accountId]: []
          }
        }))
      }
    }),
    {
      name: 'satsigner-nostr',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useNostrStore, generateColorFromNpub }
