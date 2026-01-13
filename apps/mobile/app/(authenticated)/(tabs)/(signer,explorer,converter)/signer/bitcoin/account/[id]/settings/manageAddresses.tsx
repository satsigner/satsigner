import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  Clipboard,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity
} from 'react-native'
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator
} from 'react-native-draggable-flatlist'
import uuid from 'react-native-uuid'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { AddressCard } from '@/components/SSAddressCard'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Address, type WatchedAddress } from '@/types/models/Address'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { getScriptVersionType } from '@/utils/address'
import { validateAddress } from '@/utils/validation'

type ManageAccountAddressesProps = {
  account: Account
  onUpdateAccount: (newAccount: Account) => void
  onViewAddressDetails: (address: Address['address']) => void
}

const tl = tn('account.settings.manageAddresses')

export default function ManageAccountAddressesPage() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccount
    ])
  )

  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account &&
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  function handleUpdateAccount(newAccount: Account) {
    const addressesNotChanged = newAccount.addresses.every(
      (address, index) => account!.addresses[index].address === address.address
    )

    if (addressesNotChanged) {
      router.back()
      return
    }

    updateAccount(newAccount)
    router.back()
  }

  function handleOnViewAddressDetails(address: Address['address']) {
    router.navigate(`/signer/bitcoin/account/${account!.id}/address/${address}`)
  }

  if (!account || !isMultiAddressWatchOnly) return <Redirect href="/" />

  return (
    <ManageAccountAddresses
      account={account}
      onUpdateAccount={handleUpdateAccount}
      onViewAddressDetails={handleOnViewAddressDetails}
    />
  )
}

export function ManageAccountAddresses({
  account,
  onUpdateAccount,
  onViewAddressDetails
}: ManageAccountAddressesProps) {
  const [addresses, setAddresses] = useState<WatchedAddress[]>([
    ...(account?.addresses || [])
  ])
  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [showDeleteAddressModal, setShowDeleteAddressModal] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [addressToDelete, setAddressToDelete] = useState('')

  function renderItem({
    item,
    getIndex,
    drag,
    isActive
  }: RenderItemParams<WatchedAddress>) {
    const index = getIndex() || 0
    const address = item
    return (
      <ScaleDecorator activeScale={1.05}>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={drag}
          delayLongPress={250}
          disabled={isActive}
          style={isActive ? styles.addressItemActive : styles.addressItem}
        >
          <AddressCard
            address={{ ...address, index }}
            showDelete={addresses.length > 2}
            onViewDetails={() => onViewAddressDetails(address.address)}
            onDelete={() => handleDeleteAddress(address.address)}
          />
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

  async function handleShowAddAddress() {
    setShowAddAddressModal(true)
    setAddressInput('')
    const content = await Clipboard.getString()
    if (content && validateAddress(content)) {
      setAddressInput(content)
      toast.info(tl('info.pasted'))
    }
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

    onUpdateAccount(updatedAccount)
  }

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
              onDragEnd={({ data }: { data: WatchedAddress[] }) =>
                setAddresses(data)
              }
              keyExtractor={(item: WatchedAddress) => item.address}
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
              onPress={handleShowAddAddress}
            />
            <SSButton
              label={t('common.save')}
              variant="secondary"
              uppercase
              disabled={addresses.length < 2}
              onPress={handleSaveChanges}
            />
          </SSVStack>
        </SSVStack>
      </SafeAreaView>
      <SSModal
        visible={showDeleteAddressModal}
        onClose={() => setShowDeleteAddressModal(false)}
        fullOpacity
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
              disabled={!addressInput || !validateAddress(addressInput)}
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
  addressItem: {
    marginVertical: 10
  },
  addressItemActive: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#333'
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
