import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

type ShareFileProps = {
  filename: string
  fileContent: string
  dialogTitle: string
  mimeType: string
}

export async function shareFile({
  filename,
  fileContent,
  dialogTitle,
  mimeType
}: ShareFileProps) {
  const fileUri = FileSystem.documentDirectory + filename

  await FileSystem.writeAsStringAsync(fileUri, fileContent)
  await Sharing.shareAsync(fileUri, { dialogTitle, mimeType })
}

export async function saveFile({
  filename,
  fileContent,
  dialogTitle,
  mimeType
}: ShareFileProps) {
  if (Platform.OS === 'android') {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (permissions.granted && permissions.directoryUri) {
      const destinationUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          filename,
          mimeType
        )
      await FileSystem.writeAsStringAsync(destinationUri, fileContent, {
        encoding: FileSystem.EncodingType.UTF8
      })
      return
    }
  }

  await shareFile({ dialogTitle, fileContent, filename, mimeType })
}

export type PickFileProps = {
  type: 'application/json' | 'text/csv' | 'text/plain' | '*/*'
  encodingOrOptions?: FileSystem.ReadingOptions
}

export async function pickFile({ type, encodingOrOptions }: PickFileProps) {
  const file = await DocumentPicker.getDocumentAsync({ type })
  if (file.canceled || !file.assets?.[0]) {
    return
  }
  return FileSystem.readAsStringAsync(file.assets[0].uri, encodingOrOptions)
}
