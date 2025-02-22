import React from 'react'
import SSUtxoExplore from '@/components/SSSpiralBlocks'
import SSButton from '@/components/SSButton'
import { useRouter } from 'expo-router'

export default function ExplorePage() {
  const router = useRouter()

  return (
    <>
      <SSUtxoExplore />
      {/* Add a button at the bottom to navigate to the main page */}
      <SSButton
        label="sign"
        variant="gradient"
        style={{ borderRadius: 0, marginTop: 16, alignSelf: 'center' }}
        onPress={() => router.push('/')}
      />
    </>
  )
}
