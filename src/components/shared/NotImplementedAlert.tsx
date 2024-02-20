import { Alert } from 'react-native';

export default function notImplementedAlert() {
  Alert.alert(
    'Coming Soon...',
    'Not yet implemented.',
    [{text: 'OK'}]
  );
}
