import { createElement, useState } from 'react'
import { act, create } from 'react-test-renderer'

import { useSeedSigning } from '@/hooks/useSeedSigning'

const MNEMONIC = `${'abandon '.repeat(11)}about`

type SeedSigning = ReturnType<typeof useSeedSigning>

// Renders the hook with the cosigner index held in state, as the page does.
async function renderSeedSigning() {
  const signWithMnemonic = jest.fn()
  const onNotice = jest.fn()
  const hook: { current: SeedSigning | null; cosignerIndex: number | null } = {
    cosignerIndex: null,
    current: null
  }
  function Harness() {
    const [cosignerIndex, setCosignerIndex] = useState<number | null>(null)
    hook.cosignerIndex = cosignerIndex
    hook.current = useSeedSigning({
      cosignerIndex,
      onNotice,
      setCosignerIndex,
      signWithMnemonic
    })
    return null
  }
  await act(async () => {
    create(createElement(Harness))
  })
  return { hook, onNotice, signWithMnemonic }
}

describe('useSeedSigning', () => {
  it('signs for the selected cosigner with the entered mnemonic', async () => {
    const { hook, signWithMnemonic } = await renderSeedSigning()

    act(() => {
      hook.current?.startSeedWordsSigning(2)
    })
    expect(hook.current?.wordCountModalVisible).toBe(true)
    expect(hook.cosignerIndex).toBe(2)

    act(() => {
      hook.current?.setSelectedWordCount(12)
      hook.current?.confirmWordCount()
    })
    expect(hook.current?.wordCountModalVisible).toBe(false)
    expect(hook.current?.seedWordsModalVisible).toBe(true)
    expect(hook.current?.selectedWordCount).toBe(12)

    act(() => {
      hook.current?.handleMnemonicValid(MNEMONIC)
    })
    act(() => {
      hook.current?.submitSeedWords()
    })

    expect(signWithMnemonic).toHaveBeenCalledWith(2, MNEMONIC)
    expect(hook.current?.seedWordsModalVisible).toBe(false)
    expect(hook.cosignerIndex).toBeNull()
  })

  it('refuses to sign once the mnemonic became invalid', async () => {
    const { hook, onNotice, signWithMnemonic } = await renderSeedSigning()

    act(() => {
      hook.current?.startSeedWordsSigning(0)
      hook.current?.confirmWordCount()
      hook.current?.handleMnemonicValid(MNEMONIC)
    })
    act(() => {
      hook.current?.handleMnemonicInvalid()
    })
    act(() => {
      hook.current?.submitSeedWords()
    })

    expect(signWithMnemonic).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith({
      key: 'common.error.validMnemonic',
      type: 'error'
    })
    expect(hook.current?.seedWordsModalVisible).toBe(true)
  })

  it('forgets the cosigner and mnemonic when closed', async () => {
    const { hook, onNotice, signWithMnemonic } = await renderSeedSigning()

    act(() => {
      hook.current?.startSeedWordsSigning(1)
      hook.current?.confirmWordCount()
      hook.current?.handleMnemonicValid(MNEMONIC)
    })
    act(() => {
      hook.current?.closeSeedWordsModal()
    })
    expect(hook.cosignerIndex).toBeNull()

    act(() => {
      hook.current?.submitSeedWords()
    })
    expect(signWithMnemonic).not.toHaveBeenCalled()
    expect(onNotice).toHaveBeenCalledWith({
      key: 'common.error.validMnemonic',
      type: 'error'
    })
  })

  it('clears the cosigner when the word count is dismissed', async () => {
    const { hook } = await renderSeedSigning()

    act(() => {
      hook.current?.startSeedWordsSigning(1)
    })
    act(() => {
      hook.current?.closeWordCountModal()
    })

    expect(hook.current?.wordCountModalVisible).toBe(false)
    expect(hook.cosignerIndex).toBeNull()
  })
})
