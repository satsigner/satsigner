import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import GlobalStyles from '../../GlobalStyles';

export default ({ onPress, title, style, textStyle }) => {
  const styles = StyleSheet.create({  
    touchableOpacity: {
      borderRadius: 3,
      backgroundColor: '#434343',
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
      style={[styles.touchableOpacity, style]}
      onPress={onPress}
    >
      <View style={styles.button}>
        <Text style={[GlobalStyles.text, styles.buttonText, textStyle]}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
