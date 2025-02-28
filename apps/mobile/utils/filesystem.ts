import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import DocumentPicker from 'react-native-document-picker'
import RNFS from 'react-native-fs'

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
  encodingOrOptions?: any
}

export async function pickFile({
  type,
  encodingOrOptions = null
}: PickFileProps) {
  const file = await DocumentPicker.pickSingle({ type })
  return RNFS.readFile(file.uri, encodingOrOptions)
}
