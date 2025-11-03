import { useState } from 'react'

import SSVStack from '@/layouts/SSVStack'
import { type Label } from '@/utils/bip329'

import SSCheckbox from './SSCheckbox'
import SSText from './SSText'

type SSLabelConflictProps = {
  conflicts: [Label, Label][] // [current, incoming][]
  onResolve: (labels: Label[]) => void
}

const conflictStrategies = ['current', 'incoming', 'merge', 'manual'] as const

type ConflictStrategy = (typeof conflictStrategies)[number]

function SSLabelConflict({ conflicts }: SSLabelConflictProps) {
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>('incoming')

  return (
    <SSVStack>
      <SSText>Select what to do with these conflicts</SSText>
      <SSVStack>
        {conflictStrategies.map((strategy) => {
          return (
            <SSCheckbox
              key={strategy}
              selected={strategy === conflictStrategy}
              label={strategy}
              onPress={() => setConflictStrategy(strategy)}
            />
          )
        })}
      </SSVStack>
      {conflicts.map(([current, incoming], index) => {
        return (
          <SSVStack key={index} gap="none">
            <SSText uppercase weight="bold" size="md">
              Conflict {index + 1}
            </SSText>
            <SSVStack gap="none">
              <SSText weight="bold">Current:</SSText>
              <SSText size="md">{current.label}</SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold">Incoming:</SSText>
              <SSText size="md">{incoming.label}</SSText>
            </SSVStack>
          </SSVStack>
        )
      })}
    </SSVStack>
  )
}

export default SSLabelConflict
