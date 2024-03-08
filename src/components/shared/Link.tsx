import {
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { AppText } from '../shared/AppText';

import { Colors, Typography } from '../../styles';

export default function Link(props: any) {
  const { text, url } = props;

  const styles = StyleSheet.create({  
    text: {
      ...Typography.textHighlight.x6,
      color: Colors.linkText,
      textDecorationLine: 'underline',
      marginHorizontal: 4,
      marginBottom: -2.5
    }
  });
  
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={props.style}
      onPress={props.onPress}
      disabled={props.disabled}
    >
      <AppText style={styles.text}>
        { text }
      </AppText>
    </TouchableOpacity>
  );
}
