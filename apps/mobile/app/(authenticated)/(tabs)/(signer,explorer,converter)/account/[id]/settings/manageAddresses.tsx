import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native'
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator
} from 'react-native-draggable-flatlist'
import uuid from 'react-native-uuid'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { getScriptVersionType } from '@/utils/address'
import { validateAddress } from '@/utils/validation'

type WatchedAddress = Address & {
  new?: boolean
}

const tl = tn('account.settings.manageAddresses')

export default function ManageAccountAddresses() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccount
    ])
  )

  const [addresses, setAddresses] = useState<WatchedAddress[]>([
    ...(account?.addresses || [])
  ])
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [showDeleteAddressModal, setShowDeleteAddressModal] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [addressToDelete, setAddressToDelete] = useState('')

  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account &&
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  function renderItem({
    item,
    getIndex,
    drag,
    isActive
  }: RenderItemParams<WatchedAddress>) {
    const index = getIndex() || 0
    const address = item

    return (
      <ScaleDecorator activeScale={1.03}>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={drag}
          delayLongPress={250}
          disabled={isActive}
          style={{
            marginVertical: 10,
            paddingVertical: isActive ? 12 : 0,
            paddingHorizontal: isActive ? 16 : 0,
            borderRadius: isActive ? 16 : 0,
            backgroundColor: isActive ? '#333' : '#000'
          }}
        >
          <SSVStack gap="sm">
            <SSText uppercase weight="bold">
              {address.new
                ? tl('addressIndex', { index })
                : tl('addressIndexNew', { index })}
            </SSText>
            <SSAddressDisplay address={address.address} />
            {!address.new && (
              <SSVStack gap="none">
                <SSText>
                  {tl('summary.balance')}
                  {': '}
                  <SSStyledSatText
                    amount={address.summary.balance}
                    textSize="sm"
                    noColor
                  />{' '}
                  {t('bitcoin.sats')}
                </SSText>
                {address.summary.satsInMempool > 0 && (
                  <SSText>
                    {tl('summary.balanceUncofirmed')}
                    {': '}
                    <SSStyledSatText
                      amount={address.summary.satsInMempool}
                      textSize="sm"
                      noColor
                    />
                    {t('bitcoin.sats')}
                  </SSText>
                )}
                <SSText>
                  {tl('summary.utxos')}
                  {': '}
                  <SSText weight="bold">{address.summary.utxos}</SSText>
                </SSText>
                <SSText>
                  {tl('summary.tx')}
                  {': '}
                  <SSText weight="bold">{address.summary.transactions}</SSText>
                </SSText>
                <SSText>
                  {t('common.label')}
                  {': '}
                  {address.label ? (
                    <SSText weight="bold">{address.label}</SSText>
                  ) : (
                    <SSText color="muted">{t('common.noLabel')}</SSText>
                  )}
                </SSText>
              </SSVStack>
            )}
            <SSHStack gap="sm" justifyBetween>
              <SSButton
                style={styles.addressActionButton}
                label={tl('detailsBtn').toUpperCase()}
                variant="secondary"
                disabled={address.new}
                onPress={() =>
                  router.navigate(
                    `/account/${accountId}/address/${address.address}`
                  )
                }
              />
              <SSButton
                style={styles.addressActionButton}
                label={tl('deleteBtn').toUpperCase()}
                variant="danger"
                onPress={() => handleDeleteAddress(address.address)}
              />
            </SSHStack>
          </SSVStack>
        </TouchableOpacity>
      </ScaleDecorator>
    )
  }

  function addAddress(address: string) {
    const newAddress: WatchedAddress = {
      address,
      label: '',
      transactions: [],
      utxos: [],
      scriptVersion: getScriptVersionType(address) || undefined,
      summary: {
        utxos: 0,
        transactions: 0,
        satsInMempool: 0,
        balance: 0
      },
      new: true
    }
    setAddresses([...addresses, newAddress])
  }

  function handleAddAddress() {
    const address = addressInput.trim()
    if (!validateAddress(address)) {
      toast.error(tl('error.invalid'))
      return
    }

    const duplicated = addresses.some((addr) => addr.address === address)
    if (duplicated) {
      toast.error(tl('error.duplicated'))
      return
    }

    addAddress(address)
    setAddressInput('')
    setShowAddAddressModal(false)
  }

  function deleteAddress(address: string) {
    setAddresses(addresses.filter((addr) => addr.address !== address))
    setShowDeleteAddressModal(false)
  }

  function handleDeleteAddress(address: string) {
    setShowDeleteAddressModal(true)
    setAddressToDelete(address)
  }

  async function handleSaveChanges() {
    if (!account) return

    const addressesNotChanged = addresses.every(
      (addr, index) => account.addresses[index].address === addr.address
    )

    if (addressesNotChanged) {
      router.back()
      return
    }

    const keys = addresses.map((addr, index) => {
      const secret: Secret = {
        externalDescriptor: `addr(${addr.address})`
      }
      const key: Key = {
        index,
        secret,
        creationType: 'importAddress',
        iv: uuid.v4().replace(/-/g, '')
      }
      return key
    })
    const keyCount = keys.length

    // we have to reset the account data because
    const updatedAccount: Account = {
      ...account,
      transactions: [],
      utxos: [],
      addresses,
      summary: {
        satsInMempool: 0,
        numberOfUtxos: 0,
        numberOfTransactions: 0,
        numberOfAddresses: addresses.length,
        balance: 0
      },
      syncStatus: 'unsynced',
      keyCount,
      keys
    }
    updateAccount(updatedAccount)

    router.back()
  }

  if (!account || !isMultiAddressWatchOnly) return <Redirect href="/" />

  return (
    <SSMainLayout style={[styles.container, styles.mainContainer]}>
      <SafeAreaView style={styles.container}>
        <SSVStack style={styles.container}>
          <SSText uppercase size="lg" weight="bold" center>
            {tl('title')}
          </SSText>
          <SSVStack gap="lg" style={styles.container}>
            <DraggableFlatList
              data={addresses}
              onDragEnd={({ data }) => setAddresses(data)}
              keyExtractor={(item) => item.address}
              renderItem={renderItem}
              style={{ flex: 1 }}
              dragItemOverflow
              containerStyle={styles.container}
            />
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              label={tl('addBtn')}
              variant="outline"
              uppercase
              onPress={() => {
                setShowAddAddressModal(true)
                setAddressInput('')
              }}
            />
            <SSButton
              label={t('common.save')}
              variant="secondary"
              uppercase
              onPress={handleSaveChanges}
            />
          </SSVStack>
        </SSVStack>
      </SafeAreaView>
      <SSModal
        visible={showDeleteAddressModal}
        onClose={() => setShowDeleteAddressModal(false)}
      >
        <SSVStack gap="lg" style={styles.modalContainer}>
          <SSText size="lg" center>
            {tl('deleteWarn')}
          </SSText>
          <SSAddressDisplay address={addressToDelete} variant="bare" />
          <SSVStack gap="sm">
            <SSButton
              label={t('common.yes')}
              variant="outline"
              uppercase
              onPress={() => deleteAddress(addressToDelete)}
            />
            <SSButton
              label={t('common.no')}
              variant="danger"
              uppercase
              onPress={() => setShowDeleteAddressModal(false)}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
      <SSModal
        visible={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.modalContainer}>
          <SSTextInput
            value={addressInput}
            onChangeText={setAddressInput}
            placeholder={tl('addInputPlaceholder')}
            numberOfLines={5}
            style={{ height: 'auto' }}
            multiline
          />
          <SSVStack gap="sm">
            <SSButton
              label={t('common.save')}
              variant="outline"
              uppercase
              onPress={() => handleAddAddress()}
            />
            <SSButton
              label={t('common.cancel')}
              variant="danger"
              uppercase
              onPress={() => setShowAddAddressModal(false)}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  addressActionButton: {
    width: '48%',
    padding: 12,
    height: 'auto'
  },
  modalContainer: {
    justifyContent: 'center',
    height: '100%',
    width: '100%'
  },
  container: {
    flex: 1,
    overflow: 'visible'
  },
  mainContainer: {
    paddingTop: 0,
    marginTop: 0,
    marginBottom: 20
  }
})
