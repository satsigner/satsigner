import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import DocumentPicker from 'react-native-document-picker'
import RNFS from 'react-native-fs'

type shareFileProps = {
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
}: shareFileProps) {
  const fileUri = FileSystem.documentDirectory + filename

  await FileSystem.writeAsStringAsync(fileUri, fileContent)
  await Sharing.shareAsync(fileUri, { mimeType, dialogTitle })
}

type pickFileProps = {
  type: 'application/json' | 'text/csv' | 'text/plain' | '*/*'
  encodingOrOptions?: any
}

export async function pickFile({
  type,
  encodingOrOptions = null
}: pickFileProps) {
  const file = await DocumentPicker.pickSingle({ type })
  return RNFS.readFile(file.uri, encodingOrOptions)
}
