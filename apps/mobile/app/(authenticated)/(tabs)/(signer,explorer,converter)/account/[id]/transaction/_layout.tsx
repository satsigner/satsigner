import { Slot, Stack } from 'expo-router'

export default function TransactionLayout() {
  return (
    <>
      <Stack.Screen options={{ headerRight: undefined }} />
      <Slot />
    </>
  )
}
