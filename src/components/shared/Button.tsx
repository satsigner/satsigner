import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { COLORS } from '../../colors';
import GlobalStyles from '../../GlobalStyles';

export default (props) => {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      backgroundColor: COLORS.gray4,
      height: 62,
      marginVertical: 10
    },  
    button: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      textTransform: 'uppercase'
    }
  });
  
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={[styles.touchableOpacity]}
      onPress={props.onPress}
    >
      <View style={styles.button}>
        <Text style={[GlobalStyles.text, styles.buttonText]}>
          {props.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
