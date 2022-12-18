import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { Colors } from '../../Colors';
import GlobalStyles from '../../GlobalStyles';

export default (props) => {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      backgroundColor: Colors.gray4,
      height: 62,
      marginVertical: 10
    },  
    button: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      ...GlobalStyles.text,
      textTransform: 'uppercase'
    }
  });
  
  return (
    <TouchableOpacity
      activeOpacity={0.5}
      style={styles.touchableOpacity}
      onPress={props.onPress}
    >
      <View style={styles.button}>
        <Text style={styles.buttonText}>
          {props.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
