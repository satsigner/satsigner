import { Alert } from 'react-native';

export default function notImplementedAlert() {
  Alert.alert(
    'Coming in two weeks',
    'Not yet implemented, but its on the roadmap...',
    [{text: 'OK'}]
  );
}
