import { nip19 } from 'nostr-tools'
import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Nip46ParsedUri } from '@/types/models/Nip46'
import { getMethodLabel } from '@/utils/nip46'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSNip46ConnectionModalProps = {
  onConnect: () => void
  onReject: () => void
  parsedUri: Nip46ParsedUri | null
  visible: boolean
}

function formatNpub(hex: string): string {
  try {
    return nip19.npubEncode(hex)
  } catch {
    return hex
  }
}

function abbreviate(value: string, chars = 16): string {
  if (value.length <= chars * 2 + 3) {
    return value
  }
  return `${value.slice(0, chars)}...${value.slice(-chars)}`
}

function parseRequestedMethods(perms: string): string[] {
  return perms
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
}

export default function SSNip46ConnectionModal({
  onConnect,
  onReject,
  parsedUri,
  visible
}: SSNip46ConnectionModalProps) {
  if (!parsedUri) {
    return null
  }

  const npub = abbreviate(formatNpub(parsedUri.clientPubkey))
  const requestedMethods = parsedUri.perms
    ? parseRequestedMethods(parsedUri.perms)
    : []

  return (
    <SSModal visible={visible} fullOpacity onClose={onReject}>
      <View style={styles.container}>
        <SSVStack gap="md" widthFull>
          <SSText size="sm" color="muted" uppercase>
            {t('nip46.confirmConnection')}
          </SSText>

          <SSVStack gap="xs">
            <SSText size="lg" weight="bold">
              {parsedUri.name ?? t('nip46.unknownApp')}
            </SSText>
            <SSText size="xs" color="muted">
              {npub}
            </SSText>
          </SSVStack>

          <SSVStack gap="xs">
            <SSText size="xs" color="muted" uppercase>
              {t('nip46.relays')}
            </SSText>
            {parsedUri.relays.map((relay) => (
              <SSText key={relay} size="xs" color="muted">
                {relay}
              </SSText>
            ))}
          </SSVStack>

          {requestedMethods.length > 0 && (
            <SSVStack gap="xs">
              <SSText size="xs" color="muted" uppercase>
                {t('nip46.requestedPermissions')}
              </SSText>
              {requestedMethods.map((method) => (
                <SSHStack key={method} gap="xs">
                  <SSText size="xs" style={styles.bullet}>
                    •
                  </SSText>
                  <SSText size="xs">{getMethodLabel(method)}</SSText>
                </SSHStack>
              ))}
            </SSVStack>
          )}

          <SSVStack gap="sm" widthFull>
            <SSButton
              label={t('nip46.connect')}
              variant="secondary"
              onPress={onConnect}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={onReject}
            />
          </SSVStack>
        </SSVStack>
      </View>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  bullet: {
    color: Colors.gray[400]
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%'
  }
})
