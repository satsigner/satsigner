import { Slot, Stack } from 'expo-router'

export default function SignAndSendLayout() {
  return (
    <>
      <Stack.Screen options={{ headerRight: undefined }} />
      <Slot />
    </>
  )
}
