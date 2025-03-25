import { Slot, Stack } from 'expo-router'

export default function AddressLayout() {
  return (
    <>
      <Stack.Screen options={{ headerRight: undefined }} />
      <Slot />
    </>
  )
}
