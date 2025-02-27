import { router, Stack, useLocalSearchParams } from 'expo-router'
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
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function TimeLock() {
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const timeLockTypes = ['BLOCK HEIGHT', 'DATE']
  const [timeLockType, setTimeLockType] = useState(timeLockTypes[0])
  const tabs = timeLockTypes.map((type) => ({ key: type }))
  const [tabIndex, setTabIndex] = useState(0)

  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [hour, setHour] = useState('')
  const [minute, setMinute] = useState('')

  const daysByMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  const renderTab = () => {
    return (
      <SSHStack style={{ marginBottom: 24 }}>
        {timeLockTypes.map((type, index) => (
          <SSButton
            key={type}
            label={type}
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
      case 'BLOCK HEIGHT':
        return <SSText>BLOCK HEIGHT</SSText>
      case 'DATE':
        return (
          <SSVStack gap="lg">
            <SSHStack>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={2025}
                  max={2050}
                  placeholder="YEAR"
                  value={year}
                  onChangeText={setYear}
                />
              </View>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={1}
                  max={12}
                  placeholder="MONTH"
                  value={month}
                  onChangeText={setMonth}
                />
              </View>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={1}
                  max={daysByMonth[Number(month) - 1 || 0]}
                  placeholder="DAY"
                  value={day}
                  onChangeText={setDay}
                />
              </View>
            </SSHStack>
            <SSHStack>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={0}
                  max={23}
                  placeholder="HOUR"
                  value={hour}
                  onChangeText={setHour}
                />
              </View>
              <View style={{ width: 'auto', flexGrow: 1 }}>
                <SSNumberInput
                  min={0}
                  max={60}
                  placeholder="MINUTE"
                  value={minute}
                  onChangeText={setMinute}
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
    router.navigate(`/account/${id}/signAndSend/ioPreview`)
  }

  function saveChanges() {
    router.navigate(`/account/${id}/signAndSend/ioPreview`)
  }

  function removeTimeLock() {
    router.navigate(`/account/${id}/signAndSend/ioPreview`)
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
          <SSText center uppercase size="lg">
            TIMELOCK
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
          <SSButton label="REMOVE" onPress={removeTimeLock} />
          <SSButton
            variant="secondary"
            label={t('common.save')}
            onPress={saveChanges}
          />
          <SSButton
            variant="ghost"
            label={t('common.cancel')}
            onPress={cancel}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

export default TimeLock
