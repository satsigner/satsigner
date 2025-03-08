import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'

import SSButton from '@/components/SSButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

const CURRENT_BLOCK_HEIGHT = 885_000
const AVERAGE_BLOCKS_PER_YEAR = 52560

// the goal of the limit is to prevent users of making the mistake of getting
// funds locked for more than 2 years
const SAFE_TIMELOCK_LIMIT = CURRENT_BLOCK_HEIGHT + AVERAGE_BLOCKS_PER_YEAR * 2

const DAYS_BY_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

type Tab = 'blockHeight' | 'date'

function TimeLock() {
  const timeLockTypes: Tab[] = ['blockHeight', 'date']
  const [timeLockType, setTimeLockType] = useState(timeLockTypes[0])

  const tabs = timeLockTypes.map((type) => ({ key: type }))
  const [tabIndex, setTabIndex] = useState(0)
  const tabLabels: Record<Tab, string> = {
    blockHeight: t('bitcoin.blockHeight'),
    date: t('date.date')
  }

  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [hour, setHour] = useState('')
  const [minute, setMinute] = useState('')
  const [blockHeight, setBlockHeight] = useState('')

  const [validDay, setValidDay] = useState(false)
  const [validYear, setValidYear] = useState(false)
  const [validMonth, setValidMonth] = useState(false)
  const [validHour, setValidHour] = useState(false)
  const [validMinute, setValidMinute] = useState(false)
  const [validBlockHeight, setValidBlockHeight] = useState(false)

  const renderTab = () => {
    return (
      <SSHStack style={{ marginBottom: 24 }}>
        {timeLockTypes.map((type, index) => (
          <SSButton
            key={type}
            label={tabLabels[type]}
            variant="outline"
            onPress={() => {
              setTimeLockType(type)
              setTabIndex(index)
            }}
            style={{
              flexGrow: 1,
              width: '45%',
              borderColor: type === timeLockType ? 'white' : 'gray'
            }}
          />
        ))}
      </SSHStack>
    )
  }

  const renderScene = ({
    route
  }: SceneRendererProps & { route: { key: string } }) => {
    switch (route.key) {
      case 'blockHeight':
        return (
          <SSNumberInput
            min={CURRENT_BLOCK_HEIGHT}
            max={SAFE_TIMELOCK_LIMIT}
            value={blockHeight}
            onChangeText={setBlockHeight}
            onValidate={setValidBlockHeight}
            placeholder={t('bitcoin.blockHeight').toUpperCase()}
            showFeedback
          />
        )
      case 'date':
        return (
          <SSVStack gap="lg">
            <SSHStack>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={2025}
                  max={2050}
                  placeholder={t('date.year').toUpperCase()}
                  value={year}
                  onChangeText={setYear}
                  onValidate={setValidYear}
                />
              </View>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={1}
                  max={12}
                  placeholder={t('date.month').toUpperCase()}
                  value={month}
                  onChangeText={setMonth}
                  onValidate={setValidMonth}
                />
              </View>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={1}
                  max={DAYS_BY_MONTH[Number(month) - 1 || 0]}
                  placeholder={t('date.day').toUpperCase()}
                  value={day}
                  onChangeText={setDay}
                  onValidate={setValidDay}
                />
              </View>
            </SSHStack>
            <SSHStack>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={0}
                  max={23}
                  placeholder={t('date.hour').toUpperCase()}
                  value={hour}
                  onChangeText={setHour}
                  onValidate={setValidHour}
                />
              </View>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={0}
                  max={60}
                  placeholder={t('date.minute').toUpperCase()}
                  value={minute}
                  onChangeText={setMinute}
                  onValidate={setValidMinute}
                />
              </View>
            </SSHStack>
          </SSVStack>
        )
      default:
        return null
    }
  }

  function cancel() {
    router.back()
  }

  function saveChanges() {
    router.back()
  }

  function removeTimeLock() {
    router.back()
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>EXTRA SECURITY</SSText>
        }}
      />
      <SSMainLayout style={{ paddingBottom: 24, paddingTop: 12 }}>
        <SSVStack justifyBetween>
          <SSVStack style={{ height: 300 }}>
            <SSText center uppercase size="lg">
              {t('transaction.build.options.timeLock')}
            </SSText>
            <TabView
              swipeEnabled={false}
              navigationState={{ index: tabIndex, routes: tabs }}
              renderScene={renderScene}
              renderTabBar={renderTab}
              onIndexChange={setTabIndex}
            />
          </SSVStack>
          <SSVStack>
            <SSButton
              uppercase
              label={t('common.remove')}
              onPress={removeTimeLock}
            />
            <SSButton
              variant="secondary"
              label={t('common.save')}
              onPress={saveChanges}
              disabled={
                (timeLockType === 'blockHeight' && !validBlockHeight) ||
                (timeLockType === 'date' &&
                  (!validYear ||
                    !validMonth ||
                    !validDay ||
                    !validHour ||
                    !validMinute))
              }
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={cancel}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

export default TimeLock
