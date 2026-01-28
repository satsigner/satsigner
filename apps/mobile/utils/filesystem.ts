import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

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
  await Sharing.shareAsync(fileUri, { mimeType, dialogTitle })
}

export type PickFileProps = {
  type: 'application/json' | 'text/csv' | 'text/plain' | '*/*'
  encodingOrOptions?: FileSystem.ReadingOptions
}

export async function pickFile({ type, encodingOrOptions }: PickFileProps) {
  const file = await DocumentPicker.getDocumentAsync({ type })
  if (file.canceled || !file.assets?.[0]) return
  return FileSystem.readAsStringAsync(file.assets[0].uri, encodingOrOptions)
}
